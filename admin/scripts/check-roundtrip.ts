import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true })
const globals = globalThis as unknown as Record<string, unknown>

globals.window = dom.window
globals.document = dom.window.document
globals.DOMParser = dom.window.DOMParser
globals.Node = dom.window.Node
globals.Element = dom.window.Element
globals.HTMLElement = dom.window.HTMLElement
globals.Text = dom.window.Text
globals.DocumentFragment = dom.window.DocumentFragment
globals.MutationObserver = dom.window.MutationObserver
globals.getComputedStyle = dom.window.getComputedStyle
globals.requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0)
globals.cancelAnimationFrame = (id: number) => clearTimeout(id)
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
})

const { Editor } = await import('@tiptap/vue-3')
const { createEditorExtensions } = await import('../src/editor/extensions.ts')
const { detectRichTextRisks, htmlToMd, mdToHtml, toPreviewSrc, toStoredSrc, retargetImagePaths } =
  await import('../src/utils/markdown.ts')

const editor = new Editor({ extensions: createEditorExtensions(), content: '' })

function roundtrip(markdown: string, contentDir: string): string {
  editor.commands.setContent(mdToHtml(markdown, contentDir), { emitUpdate: false })
  return htmlToMd(editor.getHTML(), contentDir)
}

const imagesIn = (markdown: string) =>
  [...markdown.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1])

let failures = 0
const fail = (msg: string) => {
  failures += 1
  console.log(`  ✗ ${msg}`)
}
const pass = (msg: string) => console.log(`  ✓ ${msg}`)

console.log('\n图片路径：文件里的相对写法 ⇄ 浏览器预览地址')
{
  const cases: Array<[string, string]> = [
    ['blog', '../../public/images/x.png'],
    ['blog/ai', '../../../public/images/x.png'],
    ['blog/a/b', '../../../../public/images/x.png'],
    ['blog/ai', '../../../public/images/Pasted%20image%2020260819182328.png'],
    ['blog/ai', '../../../public/images/x.png?v=2'],
    ['pages', '../../public/images/x.png'],
    ['pages/sub', '../../../public/images/x.png'],
  ]

  for (const [dir, src] of cases) {
    const back = toStoredSrc(toPreviewSrc(src, dir), dir)
    if (back === src) pass(`${dir}: ${src}`)
    else fail(`${dir}: ${src} → ${toPreviewSrc(src, dir)} → ${back}`)
  }

  for (const src of [
    '/images/a.png',
    'https://example.com/a.png',
    'data:image/png;base64,AAA',
    '#anchor',
    '../nope/missing.png',
  ]) {
    if (toPreviewSrc(src, 'blog/ai') === src) pass(`原样保留 ${src}`)
    else fail(`${src} 被改成了 ${toPreviewSrc(src, 'blog/ai')}`)
  }

  const moved = retargetImagePaths('![](../../../public/images/x.png)\n', 'blog/ai', 'blog')
  if (moved.trim() === '![](../../public/images/x.png)') pass('换目录后图片层数被修正')
  else fail(`换目录后的路径不对：${moved.trim()}`)

  const untouched = retargetImagePaths('![](https://example.com/a.png)\n', 'blog/ai', 'blog')
  if (untouched.includes('https://example.com/a.png')) pass('换目录不影响外链图片')
  else fail('外链图片被改了')
}

console.log('\n各种 markdown 语法的往返')
{
  const cases: Array<[string, string]> = [
    ['行内图片', '前面 ![图](../../../public/images/x.png) 后面\n'],
    ['独立图片', '![](../../../public/images/x.png)\n'],
    ['文件名带 %20 的图片', '![](../../../public/images/Pasted%20image%2020260819182328.png)\n'],
    ['外链图片', '![](https://example.com/a.png)\n'],
    ['加粗 斜体 删除线 行内代码', '**粗** *斜* ~~删~~ `码`\n'],
    ['链接', '[文字](https://example.com)\n'],
    ['六级标题', '# 一\n\n## 二\n\n### 三\n\n#### 四\n\n##### 五\n\n###### 六\n'],
    ['标题里的序号', '##### 1. 收集问题\n'],
    ['有序列表', '1. 甲\n2. 乙\n3. 丙\n'],
    ['无序列表嵌套', '- 甲\n  - 甲一\n  - 甲二\n- 乙\n'],
    ['引用', '> 引用一行\n'],
    ['围栏代码带语言', '```c\nint add(int a, int b) {\n  return a + b;\n}\n```\n'],
    ['围栏代码不带语言', '```\nplain text\n```\n'],
    ['表格', '| a | b |\n| --- | --- |\n| 1 | 2 |\n'],
    ['分割线', '前\n\n---\n\n后\n'],
    ['中文标点和 emoji', '注意！这是「测试」👇 —— 破折号\n'],
  ]

  for (const [label, markdown] of cases) {
    const back = roundtrip(markdown, 'blog/ai')
    if (back.trim() === markdown.trim()) pass(label)
    else fail(`${label}\n      原: ${JSON.stringify(markdown)}\n      新: ${JSON.stringify(back)}`)
  }
}

console.log('\n富文本撑不住的语法要能被识别（界面上据此提示改用源码标签）')
{
  const shouldWarn: Array<[string, string]> = [
    ['折叠块', '<details>\n<summary>点开</summary>\n内容\n</details>\n'],
    ['下划线', '这是<u>下划线</u>文字\n'],
    ['居中 div', '<div align="center">居中</div>\n'],
    ['任务列表', '- [ ] 待办\n- [x] 完成\n'],
    ['脚注', '正文[^1]\n\n[^1]: 注解\n'],
  ]

  for (const [label, markdown] of shouldWarn) {
    if (detectRichTextRisks(markdown).length) pass(`识别出 ${label}`)
    else fail(`没识别出 ${label}`)
  }

  const codeOnly = '```c\n#include <stdio.h>\nprintf("%d\\n", a < b);\n```\n'
  if (!detectRichTextRisks(codeOnly).length) pass('代码块里的尖括号不误报')
  else fail(`代码块被误判：${JSON.stringify(detectRichTextRisks(codeOnly))}`)

  const inlineCode = '用 `<div>` 包一层\n'
  if (!detectRichTextRisks(inlineCode).length) pass('行内代码里的标签不误报')
  else fail('行内代码被误判')
}

console.log('\n加载内容不会触发改动事件（编辑页靠这个判断「未保存」）')
{
  const samples: Array<[string, string]> = [
    ['普通段落', '一段文字。\n'],
    ['结尾是图片', '文字\n\n![](../../../public/images/x.png)\n'],
    ['结尾是表格', '| a | b |\n| --- | --- |\n| 1 | 2 |\n'],
    ['结尾是代码块', '```c\nint main(void) { return 0; }\n```\n'],
    ['结尾是分割线', '文字\n\n---\n'],
    ['结尾是列表', '- 甲\n- 乙\n'],
    ['空正文', ''],
  ]

  for (const [label, markdown] of samples) {
    let updates = 0
    const probe = new Editor({
      extensions: createEditorExtensions(),
      content: mdToHtml(markdown, 'blog/ai'),
      onUpdate: () => {
        updates += 1
      },
    })
    await new Promise((r) => setTimeout(r, 30))
    if (updates === 0) pass(`${label}：加载后没有 update 事件`)
    else fail(`${label}：加载就触发了 ${updates} 次 update，会被误判成「已修改」`)
    probe.destroy()
  }

  let updates = 0
  const probe = new Editor({
    extensions: createEditorExtensions(),
    content: '<p>初始</p>',
    onUpdate: () => {
      updates += 1
    },
  })
  probe.commands.setContent('<p>换成别的</p>', { emitUpdate: false })
  await new Promise((r) => setTimeout(r, 30))
  if (updates === 0) pass('setContent({ emitUpdate: false }) 不触发 update')
  else fail(`setContent 触发了 ${updates} 次 update`)
  probe.destroy()
}

const blogRoot = process.env.ADMIN_BLOG_ROOT
  ? path.resolve(process.env.ADMIN_BLOG_ROOT)
  : path.resolve(import.meta.dirname, '../..')

const collections = [
  { label: '文章', dir: path.join(blogRoot, 'content', 'blog'), base: 'blog' },
  { label: '页面', dir: path.join(blogRoot, 'content', 'pages'), base: 'pages' },
] as const

for (const collection of collections) {
  console.log(`\n真实${collection.label}（${collection.dir}）`)

  const files: string[] = []
  const walk = async (dir: string, base = '') => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const rel = base ? `${base}/${entry.name}` : entry.name
      if (entry.isDirectory()) await walk(path.join(dir, entry.name), rel)
      else if (entry.name.endsWith('.md')) files.push(rel)
    }
  }
  await walk(collection.dir).catch((err: Error) => {
    console.log(`  找不到目录：${err.message}`)
  })

  for (const rel of files) {
    const raw = await readFile(path.join(collection.dir, rel), 'utf8')
    const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
    const subdir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : ''
    const contentDir = [collection.base, ...(subdir ? subdir.split('/') : [])].join('/')

    const back = roundtrip(body, contentDir)
    const before = imagesIn(body)
    const after = imagesIn(back)

    try {
      assert.deepEqual(after, before)
    } catch {
      fail(`${rel} 的图片路径变了：\n      原: ${JSON.stringify(before)}\n      新: ${JSON.stringify(after)}`)
      continue
    }

    const count = (re: RegExp, s: string) => (s.match(re) ?? []).length
    const same = [
      ['标题', /^#{1,6} /gm],
      ['围栏', /^```/gm],
      ['表格行', /^\|/gm],
      ['列表项', /^\s*(?:[-*+]|\d+\.) /gm],
    ] as const

    const changed = same.filter(([, re]) => count(re, body) !== count(re, back))
    const risks = detectRichTextRisks(body)

    if (changed.length && !risks.length) {
      fail(
        `${rel} 结构数量变了：` +
          changed.map(([label, re]) => `${label} ${count(re, body)}→${count(re, back)}`).join('、'),
      )
    } else {
      const note = risks.length ? `（含${risks.map((r) => r.label).join('、')}，界面会提示走源码标签）` : ''
      pass(`${rel} ${body.length}→${back.length} 字节，图片 ${before.length} 个原样保留${note}`)
    }
  }
}

console.log(failures ? `\n有 ${failures} 项没过\n` : '\n全部通过\n')
process.exit(failures ? 1 : 0)
