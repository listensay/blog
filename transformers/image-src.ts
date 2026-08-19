import { defineTransformer } from '@nuxt/content'

/**
 * 把正文里的**相对**图片路径改写成站点 URL。
 *
 * 背景：图片放在 `public/images/`，前端要的是站点绝对路径 `/images/x.png`，
 * 但这个写法在本地编辑器里预览不出来 —— Typora 把前导 `/` 当文件系统根，
 * Obsidian 也不认带前导斜杠的库内路径。两边都原生认的只有相对路径。
 *
 * 所以约定：**正文写相对路径** `![](../../public/images/x.png)`，
 * 写稿时 Typora / Obsidian / VS Code / GitHub 都能直接看到图；
 * 构建时由本 transformer 解析成 `/images/x.png` 存进内容库。
 *
 * 已经能用的写法（`/images/x.png`、`https://…`、`data:…`）一律不动，
 * 所以老文章不用跟着改。
 */

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

/**
 * 已经是可直接使用的 URL：协议（http:、data:、mailto:）、协议相对 `//`、
 * 站点绝对路径 `/`、纯锚点 `#`。这些不需要解析。
 */
function isUsableUrl(src: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(src)
}

/**
 * 纯字符串版 posix 路径规范化。不引 node:path —— transformer 由内容构建流程调用，
 * 不保证一定在 Node 环境里跑。返回 null 表示 `..` 越过了项目根。
 *
 * 不需要先解码 percent-encoding：markdown parser 会把中文和空格编码成
 * `%E4%B8%AD` / `%20`，而 `.`、`..`、`/` 这些参与解析的字符都是 ASCII 原样保留的。
 */
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

/**
 * 把相对路径解析成站点 URL。
 *
 * 只有解析结果**确实落在 public/ 里**才改写。其余情况保持原样并告警 ——
 * 这一条别放宽：早先偷懒版本会把 `../nope/missing.png` 直接拼成
 * `/nope/missing.png` 且不报警，正是「本地预览有图、线上一片空白」那类坑。
 */
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
