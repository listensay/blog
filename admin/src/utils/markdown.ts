// Markdown ⇄ HTML 转换，以及图片路径「文件里的相对写法」⇄「浏览器预览地址」的换算（算法同 blog/transformers/image-src.ts）。
// 各函数的 contentDir 指文件所在目录、相对 content/：`content/blog/ai/x.md` 传 `blog/ai`。
import MarkdownIt, { type MarkdownIt as MarkdownItInstance } from 'markdown-it'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'

/** admin 挂载 blog/public 的前缀 */
export const PUBLIC_MOUNT = '/blog-public'

/** content 目录名。`contentDir` 是相对它的路径，所以回到项目根至少要跳过它这一层 */
const CONTENT_DIR = 'content'

/** 文章集合在 content/ 下的目录 */
export const POSTS_DIR = 'blog'
/** 固定页集合在 content/ 下的目录 */
export const PAGES_DIR = 'pages'

/** 文章的「子目录」（`ai`、空串）→ 相对 content/ 的目录（`blog/ai`、`blog`） */
export function postContentDir(subdir: string): string {
  return [POSTS_DIR, ...(subdir ? subdir.split('/').filter(Boolean) : [])].join('/')
}

/** 页面的文件名（`about`、`a/b`）→ 相对 content/ 的目录（`pages`、`pages/a`） */
export function pageContentDir(name: string): string {
  const segments = name.split('/').filter(Boolean)
  // 最后一段是文件名本身，不算目录
  return [PAGES_DIR, ...segments.slice(0, -1)].join('/')
}

/** 已经能直接用的 URL：带协议、协议相对、站点绝对路径、纯锚点 */
const USABLE_URL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i

/** 从这个文件所在目录回到项目根要跳几层：content/ 本身一层，加上它下面的每一层 */
export function upLevels(contentDir: string): number {
  return 1 + contentDir.split('/').filter(Boolean).length
}

/** 这个文件要怎么写 public/ 的相对前缀，如 `blog/ai` → `../../../public/` */
export function publicPrefixFor(contentDir: string): string {
  return `${'../'.repeat(upLevels(contentDir))}public/`
}

/** 新插入的图片在正文里的写法 */
export function imageMarkdownPath(contentDir: string, imageName: string): string {
  return `${publicPrefixFor(contentDir)}images/${encodeURI(imageName)}`
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

/** 文件里的写法 → 浏览器能预览的地址。解析不到 public/ 里就原样返回（这种图线上也是 404） */
export function toPreviewSrc(src: string, contentDir: string): string {
  if (!src || USABLE_URL.test(src)) return src

  const [rawPath, suffix] = splitSuffix(src)
  const fileDir = [CONTENT_DIR, ...contentDir.split('/').filter(Boolean)].join('/')
  const resolved = normalizePath(`${fileDir}/${rawPath}`)

  if (!resolved || !resolved.startsWith('public/')) return src
  return `${PUBLIC_MOUNT}/${resolved.slice('public/'.length)}${suffix}`
}

/** 浏览器地址 → 文件里的写法，`toPreviewSrc` 的逆运算 */
export function toStoredSrc(src: string, contentDir: string): string {
  if (!src.startsWith(`${PUBLIC_MOUNT}/`)) return src
  const rest = src.slice(PUBLIC_MOUNT.length + 1)
  return `${publicPrefixFor(contentDir)}${rest}`
}

/** 站点绝对路径 → 后台的预览地址（友链头像那类不走 image-src 的字段用）。相对路径原样返回，预览显示不出来（和线上一致） */
export function toSitePreviewSrc(src: string): string {
  if (!src) return ''
  // 外链、协议相对、data: 原样用
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(src)) return src
  if (!src.startsWith('/')) return src
  return `${PUBLIC_MOUNT}${src}`
}

// markdown-it 实例，图片 src 在渲染前就换成预览地址。
// 返回类型用具名导出 MarkdownItInstance：拿默认导出当类型会报 TS2749。
function createRenderer(contentDir: string): MarkdownItInstance {
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
        if (typeof src === 'string' && src) child.attrSet('src', toPreviewSrc(src, contentDir))
      }
    }
    return true
  })

  // 去掉代码块末尾那一个换行，否则编辑器里每个代码块下面都多出一个空行。
  // 只去一个：作者自己写的收尾空行要留着。存回时 turndown 会补上，往返仍然一字不差。
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
export function mdToHtml(markdown: string, contentDir: string): string {
  return createRenderer(contentDir).render(markdown)
}

function createTurndown(contentDir: string): TurndownService {
  const service = new TurndownService({
    headingStyle: 'atx', // `## 标题`，和现有文章一致
    bulletListMarker: '-', // 现有文章用的是 -
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
    hr: '---',
    // 硬换行写成行尾反斜杠（CommonMark）：默认的两个尾随空格看不见、容易被吃掉，一吃掉换行就没了
    br: '\\',
    preformattedCode: true,
  })

  // 表格、删除线走 GFM 插件
  service.use(gfm)

  /** 删除线补成两个 `~`（gfm 插件只出一个）：单个 `~` 存回去后下次打开会变成字面量 */
  service.addRule('adminStrikethrough', {
    filter: ['del', 's'],
    replacement: (content) => (content ? `~~${content}~~` : ''),
  })

  // 列表项标记压成 `- 项`、`1. 项`（turndown 默认补到 4 字符宽），否则有列表的老文章一保存就整段 diff。
  // 续行缩进跟着标记宽度走，嵌套列表才不会散架。
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
      const stored = toStoredSrc(src, contentDir)
      return `![${alt}](${stored}${title ? ` "${title}"` : ''})`
    },
  })

  return service
}

/** 撤掉标题行里 `1\.` 的多余转义（渲染结果一样，只是源码难看） */
function tidyHeadingEscapes(markdown: string): string {
  return markdown.replace(/^#{1,6} .*$/gm, (line) => line.replace(/(\d)\\\./g, '$1.'))
}

// 把 tiptap 吐出的 HTML 修成 turndown 认得的形状。不做这一步：紧凑列表变松散（一保存整段 diff）、
// colspan/内联样式进 markdown；表格更要删掉 tiptap 插的 <colgroup>，否则 gfm 判不出表头、整块变裸 HTML
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

  // `<li><p>甲</p><ul>…</ul></li>` 里的 `<p>` 也要拆，留着嵌套列表前面会多一个空行（紧凑变松散）
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
export function htmlToMd(html: string, contentDir: string): string {
  const markdown = tidyHeadingEscapes(createTurndown(contentDir).turndown(normalizeEditorHtml(html)))
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

// 正文里所有图片地址，按出现顺序（markdown 语法和裸 `<img>` 都算）。
// 给 AI 改写后的完整性校验用：图片路径改错了本地预览照样有图，线上一片空白。
export function collectImageSrcs(markdown: string): string[] {
  const out: string[] = []
  // matchAll 会克隆正则，不共享 lastIndex，所以复用这两个带 g 的常量是安全的
  for (const match of markdown.matchAll(MD_IMAGE)) out.push(match[2] ?? '')
  for (const match of markdown.matchAll(HTML_IMAGE_SRC)) out.push((match[2] ?? '').slice(1, -1))
  return out
}

// 文章换目录时把图片相对路径重定向到新深度：`../` 层数是跟着所在目录算的，不改的话
// 本地预览照样有图、线上一片空白（blog 构建只 warn 一行）。只动图片 src。
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
