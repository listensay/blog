/**
 * Markdown ⇄ HTML 的转换，以及图片路径在「文件里怎么写」和「浏览器怎么预览」之间的换算。
 *
 * ## 图片路径为什么要换算
 *
 * blog 的约定是正文写**相对路径**（`![](../../../public/images/x.png)`），这样 Typora、
 * Obsidian、VS Code、GitHub 都能直接预览；构建时由 blog/transformers/image-src.ts
 * 解析成站点路径 `/images/x.png`。
 *
 * 后台是另一个 dev server，`../../../public/...` 在浏览器里当然打不开，所以这里做同样的
 * 解析，只是终点换成 admin 自己挂的 `/blog-public/...`（见 server/blog-api.ts）。
 * 存回文件时再换算回相对路径 —— 两个方向互为逆运算，图片没动过的文章往返之后
 * 正文一个字节都不变。
 *
 * 解析算法**照抄 blog/transformers/image-src.ts**：相对 `content/blog/<子目录>/` 解析，
 * 落在 `public/` 里才认。两边算法一致，后台看到的图和线上就是同一张。
 *
 * 不做 percent-decode：markdown 会把空格写成 `%20`，而 `.`、`..`、`/` 都是 ASCII，
 * 直接在编码后的字符串上做路径运算是安全的（和 image-src.ts 同一个理由）。
 */
import MarkdownIt, { type MarkdownIt as MarkdownItInstance } from 'markdown-it'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'

/** admin 挂载 blog/public 的前缀 */
export const PUBLIC_MOUNT = '/blog-public'

/** 文章都在 content/blog/ 下面，所以从文章目录回到项目根至少要跳 2 层 */
const CONTENT_DEPTH_BASE = 2

/** 已经能直接用的 URL：带协议、协议相对、站点绝对路径、纯锚点 */
const USABLE_URL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i

/** 一篇文章的目录深度决定要写几层 `../` */
export function upLevels(dir: string): number {
  return CONTENT_DEPTH_BASE + (dir ? dir.split('/').filter(Boolean).length : 0)
}

/** 这篇文章要怎么写 public/ 的相对前缀，如 dir='ai' → `../../../public/` */
export function publicPrefixFor(dir: string): string {
  return `${'../'.repeat(upLevels(dir))}public/`
}

/** 新插入的图片在正文里的写法 */
export function imageMarkdownPath(dir: string, imageName: string): string {
  return `${publicPrefixFor(dir)}images/${encodeURI(imageName)}`
}

/** 纯字符串版路径规范化，`..` 越过根返回 null。和 image-src.ts 保持一致 */
function normalizePath(input: string): string | null {
  const out: string[] = []
  for (const seg of input.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') {
      if (out.length === 0) return null
      out.pop()
      continue
    }
    out.push(seg)
  }
  return out.join('/')
}

/** 切出 `?query` / `#hash`，它们不参与路径解析 */
function splitSuffix(src: string): [string, string] {
  const cut = src.search(/[?#]/)
  return cut === -1 ? [src, ''] : [src.slice(0, cut), src.slice(cut)]
}

/**
 * 文件里的写法 → 浏览器能预览的地址。
 * 解析不到 public/ 里就原样返回（和线上行为一致：这种图线上也是 404）。
 */
export function toPreviewSrc(src: string, dir: string): string {
  if (!src || USABLE_URL.test(src)) return src

  const [rawPath, suffix] = splitSuffix(src)
  const fileDir = ['content', 'blog', ...(dir ? dir.split('/') : [])].join('/')
  const resolved = normalizePath(`${fileDir}/${rawPath}`)

  if (!resolved || !resolved.startsWith('public/')) return src
  return `${PUBLIC_MOUNT}/${resolved.slice('public/'.length)}${suffix}`
}

/** 浏览器地址 → 文件里的写法，`toPreviewSrc` 的逆运算 */
export function toStoredSrc(src: string, dir: string): string {
  if (!src.startsWith(`${PUBLIC_MOUNT}/`)) return src
  const rest = src.slice(PUBLIC_MOUNT.length + 1)
  return `${publicPrefixFor(dir)}${rest}`
}

/**
 * markdown-it 实例。图片 src 在渲染前就改成预览地址。
 *
 * 默认导出是**值**（可调用的构造器），实例类型是另外一个同名的具名导出，
 * 所以上面把它 import 成 `MarkdownItInstance`；直接拿默认导出当类型会报 TS2749。
 */
function createRenderer(dir: string): MarkdownItInstance {
  const md = new MarkdownIt({
    html: true, // 老文章里有裸 HTML，先原样渲染出来（能不能编辑另说，见 detectRichTextRisks）
    linkify: false, // 不自动把裸链接变成 <a>，否则存回去会多出一堆 markdown 链接
    breaks: false, // 单个换行不当 <br>，和 @nuxt/content 的默认行为一致
    typographer: false, // 不做引号/破折号替换，否则存回去正文字符会被改写
  })

  md.core.ruler.push('admin-preview-src', (state) => {
    for (const token of state.tokens) {
      for (const child of token.type === 'inline' ? (token.children ?? []) : [token]) {
        if (child.type !== 'image') continue
        // attrGet 的返回类型是 string | number | null（markdown-it 允许数字属性值）
        const src = child.attrGet('src')
        if (typeof src === 'string' && src) child.attrSet('src', toPreviewSrc(src, dir))
      }
    }
    return true
  })

  /**
   * 代码块内容末尾那个换行去掉，否则**编辑器里每个代码块下面都会多出一个空行**。
   *
   * 来源：Markdown 的围栏代码块按规范一定以换行结尾，所以 markdown-it 给出的
   * token 内容是 `"cd 路径\n"`。在浏览器里 `<pre>` 会把这个换行**如实渲染成一个空行**，
   * 而 tiptap 把它读成 codeBlock 节点的文本内容，于是编辑区里那个空行还能把光标放进去，
   * 看着就像代码块凭空多了一行。
   *
   * 只去掉**一个**换行：代码本来就以空行结尾的（`"a\n\n"`）去掉一个还剩一个，
   * 那个空行是作者写的，得留着。
   *
   * 存回文件时 turndown 会自己补上收尾换行，所以往返仍然一字不差（有测试覆盖）。
   */
  md.core.ruler.push('admin-trim-code-newline', (state) => {
    for (const token of state.tokens) {
      if (token.type !== 'fence' && token.type !== 'code_block') continue
      if (token.content.endsWith('\n')) token.content = token.content.slice(0, -1)
    }
    return true
  })

  return md
}

/** 富文本编辑器要吃的 HTML */
export function mdToHtml(markdown: string, dir: string): string {
  return createRenderer(dir).render(markdown)
}

function createTurndown(dir: string): TurndownService {
  const service = new TurndownService({
    headingStyle: 'atx', // `## 标题`，和现有文章一致
    bulletListMarker: '-', // 现有文章用的是 -
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
    hr: '---',
    // 硬换行写成行尾反斜杠（CommonMark）。默认的两个尾随空格看不见、容易被编辑器
    // 或格式化工具吃掉，一吃掉换行就没了；写成空字符串更糟 —— 单个 \n 在 markdown
    // 里根本不是换行，正文会被悄悄合成一行
    br: '\\',
    preformattedCode: true,
  })

  // 表格、删除线走 GFM 插件
  service.use(gfm)

  /**
   * 删除线：gfm 插件出的是单个 `~`，而 GFM 规范要两个。写成 `~删~` 存回文件后
   * markdown-it 不认，下次打开就变成字面量 `~删~` —— 正文被改坏了还看不出来。
   */
  service.addRule('adminStrikethrough', {
    filter: ['del', 's'],
    replacement: (content) => (content ? `~~${content}~~` : ''),
  })

  /**
   * 列表项：turndown 默认把标记补成 4 字符宽（`-   项`、`1.  项`），
   * 而现有文章写的是 `- 项`、`1. 项`。不改的话每篇有列表的文章一保存就整段 diff。
   * 续行缩进跟着标记宽度走，嵌套列表才不会散架。
   */
  service.addRule('adminListItem', {
    filter: 'li',
    replacement: (content, node, options) => {
      const element = node as unknown as HTMLElement
      const parent = element.parentNode as HTMLElement | null

      let prefix = `${options.bulletListMarker} `
      if (parent && parent.nodeName === 'OL') {
        const start = parent.getAttribute('start')
        const index = Array.prototype.indexOf.call(parent.children, element)
        prefix = `${start ? Number(start) + index : index + 1}. `
      }

      const body = content
        .replace(/^\n+/, '')
        // 尾部换行全部去掉再自己补：tiptap 的 `<li><p>x</p></li>` 会让 content
        // 以 `\n\n` 结尾，留着就会多出一行只有缩进空格的空行
        .replace(/\s+$/, '')
        .replace(/\n/g, `\n${' '.repeat(prefix.length)}`)

      return prefix + body + (element.nextSibling ? '\n' : '')
    },
  })

  // 图片：把预览地址换回文件里的相对写法。
  // 用 getAttribute 而不是 node.src —— 后者会被浏览器解析成绝对 URL
  service.addRule('adminImage', {
    filter: 'img',
    replacement: (_content, node) => {
      const element = node as unknown as HTMLElement
      const src = element.getAttribute('src') ?? ''
      const alt = element.getAttribute('alt') ?? ''
      const title = element.getAttribute('title')
      if (!src) return ''
      const stored = toStoredSrc(src, dir)
      return `![${alt}](${stored}${title ? ` "${title}"` : ''})`
    },
  })

  return service
}

/**
 * turndown 会把行首的 `1.` 转义成 `1\.`（免得被读成有序列表）。
 * 在标题行里这个转义没必要，渲染结果一样，但源码难看 —— 只在标题行里撤掉它。
 */
function tidyHeadingEscapes(markdown: string): string {
  return markdown.replace(/^#{1,6} .*$/gm, (line) => line.replace(/(\d)\\\./g, '$1.'))
}

/**
 * 把 tiptap 吐出的 HTML 修成 turndown 认得的形状。
 *
 * 三处是实测出来的坑，不做这一步正文会被改坏：
 *
 * 1. **表格会整块变成裸 HTML**。turndown-plugin-gfm 只转「有表头行」的表格，判定条件是
 *    表头 `<tr>` 必须是 `<thead>` 或**第一个 `<tbody>`** 的第一个孩子；而 tiptap 会在
 *    最前面插一个 `<colgroup>`（列宽），于是 `<tbody>` 不再是第一个孩子，判定失败，
 *    整张表被原样 keep 成 HTML。删掉 colgroup、把表头行显式包进 `<thead>` 就好了。
 * 2. **列表项里的 `<p>`**。tiptap 一律写成 `<li><p>文字</p></li>`，turndown 处理成
 *    段落就会多出空行，紧凑列表变成松散列表，每篇有列表的文章都会整段 diff。
 * 3. `colspan="1"` / `min-width` 内联样式是 tiptap 的实现细节，不该进 markdown。
 */
function normalizeEditorHtml(html: string): string {
  if (!html.trim()) return html

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const body = doc.body

  const unwrap = (element: Element) => {
    const parent = element.parentNode
    if (!parent) return
    while (element.firstChild) parent.insertBefore(element.firstChild, element)
    parent.removeChild(element)
  }

  for (const colgroup of body.querySelectorAll('colgroup')) colgroup.remove()

  for (const table of body.querySelectorAll('table')) {
    const firstRow = table.rows[0]
    const inTbody = firstRow?.parentElement?.tagName === 'TBODY'
    const allHeaderCells =
      !!firstRow && firstRow.cells.length > 0 && [...firstRow.cells].every((c) => c.tagName === 'TH')

    if (firstRow && inTbody && allHeaderCells) {
      const thead = doc.createElement('thead')
      thead.append(firstRow) // append 会把它从 tbody 里搬过来
      table.insertBefore(thead, table.firstChild)
    }
  }

  // 单元格和列表项里只有一个段落时，把 <p> 拆掉
  for (const p of body.querySelectorAll('li > p:only-child, th > p:only-child, td > p:only-child')) {
    unwrap(p)
  }

  /**
   * `<li><p>甲</p><ul>…</ul></li>` 里的 `<p>` 也要拆。
   * 留着的话嵌套列表前面会多一个空行（紧凑列表变松散），而 turndown 对
   * 「`<ul>` 是 `<li>` 的最后一个元素孩子」这种形状本来就有紧凑处理。
   */
  for (const li of body.querySelectorAll('li')) {
    const [first, ...rest] = [...li.children]
    const restAllLists = rest.length > 0 && rest.every((el) => el.tagName === 'UL' || el.tagName === 'OL')
    if (first?.tagName === 'P' && restAllLists) unwrap(first)
  }

  for (const element of body.querySelectorAll('[colspan="1"]')) element.removeAttribute('colspan')
  for (const element of body.querySelectorAll('[rowspan="1"]')) element.removeAttribute('rowspan')
  for (const element of body.querySelectorAll('table [style], table[style]')) {
    element.removeAttribute('style')
  }

  return body.innerHTML
}

/** 富文本编辑器吐出的 HTML → 要写进文件的 Markdown */
export function htmlToMd(html: string, dir: string): string {
  const markdown = tidyHeadingEscapes(createTurndown(dir).turndown(normalizeEditorHtml(html)))
  return (
    markdown
      // 缩进过的空行会留下一串尾随空格（列表项内的空行），清掉
      .replace(/^[ \t]+$/gm, '')
      .replace(/\s+$/, '') + '\n' // 文件统一以单个换行收尾
  )
}

/** 富文本编辑器撑不住的语法。命中就提示用「Markdown 源码」标签改 */
export interface RichTextRisk {
  label: string
  sample: string
}

/** 去掉代码块和行内代码，避免把代码里的尖括号误判成原始 HTML */
function stripCode(markdown: string): string {
  return markdown
    .replace(/^```[\s\S]*?^```/gm, '')
    .replace(/^~~~[\s\S]*?^~~~/gm, '')
    .replace(/`[^`\n]*`/g, '')
}

const RISK_RULES: Array<{ label: string; re: RegExp }> = [
  { label: '原始 HTML 标签', re: /<\/?([a-z][a-z0-9-]*)\b[^>]*>/i },
  { label: 'MDC 组件语法（::component）', re: /^:::?[a-z]/im },
  { label: '脚注（[^1]）', re: /\[\^[^\]]+\]/ },
  { label: '任务列表（- [ ]）', re: /^[-*+] \[[ xX]\]/m },
  { label: '行内数学公式（$…$）', re: /\$[^$\n]+\$/ },
  { label: '定义列表', re: /^: {2,}\S/m },
]

export function detectRichTextRisks(markdown: string): RichTextRisk[] {
  const text = stripCode(markdown)
  const risks: RichTextRisk[] = []

  for (const { label, re } of RISK_RULES) {
    const match = re.exec(text)
    if (match) risks.push({ label, sample: match[0].slice(0, 60) })
  }

  return risks
}

/** markdown 图片：`![alt](src "title")`，src 不含空白 */
const MD_IMAGE = /(!\[[^\]]*\]\(\s*)([^)\s]+)/g
/** HTML 图片：`<img src="...">` */
const HTML_IMAGE_SRC = /(<img\b[^>]*?\ssrc=)("([^"]*)"|'([^']*)')/gi

/**
 * 正文里所有图片的地址，按出现顺序。markdown 语法和裸 `<img>` 都算。
 *
 * 给 AI 改写后的完整性校验用（见 utils/ai.ts）：图片路径是这个仓库最脆弱的东西 ——
 * 改错了本地预览照样有图，线上一片空白，所以要逐个比对。
 */
export function collectImageSrcs(markdown: string): string[] {
  const out: string[] = []
  // matchAll 会克隆正则，不共享 lastIndex，所以复用这两个带 g 的常量是安全的
  for (const match of markdown.matchAll(MD_IMAGE)) out.push(match[2] ?? '')
  for (const match of markdown.matchAll(HTML_IMAGE_SRC)) out.push((match[2] ?? '').slice(1, -1))
  return out
}

/**
 * 文章换目录时，把正文里的图片相对路径重定向到新深度。
 *
 * 为什么必须做：相对路径里 `../` 的层数是**跟着文章所在目录算的**。一篇
 * `content/blog/ai/x.md` 写 `../../../public/images/a.png`，挪到顶层 `content/blog/`
 * 之后同样的字符串会解析到 `content/` 外面 —— blog 构建时只会打一行 warn，
 * 本地预览还是有图，线上一片空白。这类问题最难发现，所以在保存时就修掉。
 *
 * 只动图片 src，其余字符一个不碰。
 */
export function retargetImagePaths(markdown: string, fromDir: string, toDir: string): string {
  if (fromDir === toDir) return markdown

  const move = (src: string) => toStoredSrc(toPreviewSrc(src, fromDir), toDir)

  return markdown
    .replace(MD_IMAGE, (_m, head: string, src: string) => `${head}${move(src)}`)
    .replace(HTML_IMAGE_SRC, (_m, head: string, quoted: string) => {
      const quote = quoted[0] ?? '"'
      const src = quoted.slice(1, -1)
      return `${head}${quote}${move(src)}${quote}`
    })
}
