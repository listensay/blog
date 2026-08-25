import { defineTransformer } from '@nuxt/content'

// 正文写相对图片路径（`![](../../public/images/x.png)`），本地编辑器才预览得出来；
// 构建时改写成站点 URL `/images/x.png`。已经能用的写法（`/`、http(s)、data:）一律不动

/** content 目录名（相对项目根）。file.id 首段是集合名，其余是相对 content/ 的路径。 */
const CONTENT_DIR = 'content'

/** 会被原样发布到站点根的目录：只有落在这里面的文件才有 URL */
const PUBLIC_DIR = 'public'

/** 带 src 的元素标签（小写） */
const SRC_TAGS = new Set(['img', 'image', 'video', 'audio', 'source', 'embed'])

/** 除 src 之外还要一起改写的属性 */
const EXTRA_ATTRS = ['poster'] as const

/** minimark 节点：元素是 `[tag, props, ...children]` 数组，文本是字符串 */
type MinimarkNode = string | [string, Record<string, unknown>, ...MinimarkNode[]]

/** 已经能直接用的 URL：带协议、协议相对 `//`、站点绝对路径 `/`、纯锚点 `#` —— 不必解析 */
function isUsableUrl(src: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(src)
}

// 纯字符串版 posix 路径规范化，不引 node:path（transformer 不保证跑在 Node 里）。
// 返回 null 表示 `..` 越过了项目根。不用先解码 percent-encoding：`.` `..` `/` 都是 ASCII
function normalizePath(path: string): string | null {
  const out: string[] = []
  for (const seg of path.split('/')) {
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

/** 相对路径 → 站点 URL。只有确实落在 public/ 里才改写，否则原样保留并告警 */
function toSiteUrl(src: string, fileDir: string, warn: (msg: string) => void): string {
  if (!src || isUsableUrl(src)) return src

  // ?query / #hash 不参与路径解析，切下来原样接回去
  const cut = src.search(/[?#]/)
  const rawPath = cut === -1 ? src : src.slice(0, cut)
  const suffix = cut === -1 ? '' : src.slice(cut)

  const resolved = normalizePath(`${fileDir}/${rawPath}`)
  if (resolved === null) {
    warn(`${src} 里的 .. 越过了项目根，无法解析`)
    return src
  }
  if (!resolved.startsWith(`${PUBLIC_DIR}/`)) {
    warn(`${src} 解析到 ${resolved}，不在 ${PUBLIC_DIR}/ 下 —— 不会被发布，线上会 404`)
    return src
  }

  return `/${resolved.slice(PUBLIC_DIR.length + 1)}${suffix}`
}

/** 深度遍历 minimark 树，就地改写 src / poster */
function rewriteTree(nodes: MinimarkNode[], rewrite: (src: string) => string): void {
  for (const node of nodes) {
    if (!Array.isArray(node)) continue

    const [tag, props, ...children] = node
    if (props && typeof props === 'object' && SRC_TAGS.has(String(tag).toLowerCase())) {
      if (typeof props.src === 'string') props.src = rewrite(props.src)
      for (const attr of EXTRA_ATTRS) {
        if (typeof props[attr] === 'string') props[attr] = rewrite(props[attr] as string)
      }
    }

    rewriteTree(children as MinimarkNode[], rewrite)
  }
}

export default defineTransformer({
  name: 'image-src',
  extensions: ['.md'],
  transform(file) {
    const f = file as Record<string, unknown>

    // id 形如 "blog/blog/文章.md"：首段是集合名，其余是相对 content/ 的路径
    const parts = String(f.id).split('/')
    parts.shift() // 去掉集合名
    parts.pop() // 去掉文件名，留目录
    const fileDir = [CONTENT_DIR, ...parts].join('/')

    const rewrite = (src: string) =>
      toSiteUrl(src, fileDir, msg => console.warn(`[image-src] ${f.id}: ${msg}`))

    const body = f.body as { value?: unknown } | undefined
    if (body && Array.isArray(body.value)) {
      rewriteTree(body.value as MinimarkNode[], rewrite)
    }

    // frontmatter 的封面图同样支持相对路径
    if (typeof f.cover === 'string') {
      return { ...file, cover: rewrite(f.cover) }
    }

    return file
  },
})
