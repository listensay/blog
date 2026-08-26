import MarkdownIt, { type MarkdownIt as MarkdownItInstance } from 'markdown-it'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'

export const PUBLIC_MOUNT = '/blog-public'

const CONTENT_DIR = 'content'

export const POSTS_DIR = 'blog'
export const PAGES_DIR = 'pages'

export function postContentDir(subdir: string): string {
  return [POSTS_DIR, ...(subdir ? subdir.split('/').filter(Boolean) : [])].join('/')
}

export function pageContentDir(name: string): string {
  const segments = name.split('/').filter(Boolean)
  return [PAGES_DIR, ...segments.slice(0, -1)].join('/')
}

const USABLE_URL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i

export function upLevels(contentDir: string): number {
  return 1 + contentDir.split('/').filter(Boolean).length
}

export function publicPrefixFor(contentDir: string): string {
  return `${'../'.repeat(upLevels(contentDir))}public/`
}

export function imageMarkdownPath(contentDir: string, imageName: string): string {
  return `${publicPrefixFor(contentDir)}images/${encodeURI(imageName)}`
}

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

function splitSuffix(src: string): [string, string] {
  const cut = src.search(/[?#]/)
  return cut === -1 ? [src, ''] : [src.slice(0, cut), src.slice(cut)]
}

export function toPreviewSrc(src: string, contentDir: string): string {
  if (!src || USABLE_URL.test(src)) return src

  const [rawPath, suffix] = splitSuffix(src)
  const fileDir = [CONTENT_DIR, ...contentDir.split('/').filter(Boolean)].join('/')
  const resolved = normalizePath(`${fileDir}/${rawPath}`)

  if (!resolved || !resolved.startsWith('public/')) return src
  return `${PUBLIC_MOUNT}/${resolved.slice('public/'.length)}${suffix}`
}

export function toStoredSrc(src: string, contentDir: string): string {
  if (!src.startsWith(`${PUBLIC_MOUNT}/`)) return src
  const rest = src.slice(PUBLIC_MOUNT.length + 1)
  return `${publicPrefixFor(contentDir)}${rest}`
}

export function toSitePreviewSrc(src: string): string {
  if (!src) return ''
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(src)) return src
  if (!src.startsWith('/')) return src
  return `${PUBLIC_MOUNT}${src}`
}

function createRenderer(contentDir: string): MarkdownItInstance {
  const md = new MarkdownIt({
    html: true,
    linkify: false,
    breaks: false,
    typographer: false,
  })

  md.core.ruler.push('admin-preview-src', (state) => {
    for (const token of state.tokens) {
      for (const child of token.type === 'inline' ? (token.children ?? []) : [token]) {
        if (child.type !== 'image') continue
        const src = child.attrGet('src')
        if (typeof src === 'string' && src) child.attrSet('src', toPreviewSrc(src, contentDir))
      }
    }
    return true
  })

  md.core.ruler.push('admin-trim-code-newline', (state) => {
    for (const token of state.tokens) {
      if (token.type !== 'fence' && token.type !== 'code_block') continue
      if (token.content.endsWith('\n')) token.content = token.content.slice(0, -1)
    }
    return true
  })

  return md
}

export function mdToHtml(markdown: string, contentDir: string): string {
  return createRenderer(contentDir).render(markdown)
}

function createTurndown(contentDir: string): TurndownService {
  const service = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
    hr: '---',
    br: '\\',
    preformattedCode: true,
  })

  service.use(gfm)

  service.addRule('adminStrikethrough', {
    filter: ['del', 's'],
    replacement: (content) => (content ? `~~${content}~~` : ''),
  })

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
        .replace(/\s+$/, '')
        .replace(/\n/g, `\n${' '.repeat(prefix.length)}`)

      return prefix + body + (element.nextSibling ? '\n' : '')
    },
  })

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

function tidyHeadingEscapes(markdown: string): string {
  return markdown.replace(/^#{1,6} .*$/gm, (line) => line.replace(/(\d)\\\./g, '$1.'))
}

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
      thead.append(firstRow)
      table.insertBefore(thead, table.firstChild)
    }
  }

  for (const p of body.querySelectorAll('li > p:only-child, th > p:only-child, td > p:only-child')) {
    unwrap(p)
  }

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

export function htmlToMd(html: string, contentDir: string): string {
  const markdown = tidyHeadingEscapes(createTurndown(contentDir).turndown(normalizeEditorHtml(html)))
  return (
    markdown
      .replace(/^[ \t]+$/gm, '')
      .replace(/\s+$/, '') + '\n'
  )
}

export interface RichTextRisk {
  label: string
  sample: string
}

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

const MD_IMAGE = /(!\[[^\]]*\]\(\s*)([^)\s]+)/g
const HTML_IMAGE_SRC = /(<img\b[^>]*?\ssrc=)("([^"]*)"|'([^']*)')/gi

export function collectImageSrcs(markdown: string): string[] {
  const out: string[] = []
  for (const match of markdown.matchAll(MD_IMAGE)) out.push(match[2] ?? '')
  for (const match of markdown.matchAll(HTML_IMAGE_SRC)) out.push((match[2] ?? '').slice(1, -1))
  return out
}

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
