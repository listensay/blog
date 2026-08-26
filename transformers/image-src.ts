import { defineTransformer } from '@nuxt/content'


const CONTENT_DIR = 'content'

const PUBLIC_DIR = 'public'

const SRC_TAGS = new Set(['img', 'image', 'video', 'audio', 'source', 'embed'])

const EXTRA_ATTRS = ['poster'] as const

type MinimarkNode = string | [string, Record<string, unknown>, ...MinimarkNode[]]

function isUsableUrl(src: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(src)
}

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

function toSiteUrl(src: string, fileDir: string, warn: (msg: string) => void): string {
  if (!src || isUsableUrl(src)) return src

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

    const parts = String(f.id).split('/')
    parts.shift()
    parts.pop()
    const fileDir = [CONTENT_DIR, ...parts].join('/')

    const rewrite = (src: string) =>
      toSiteUrl(src, fileDir, msg => console.warn(`[image-src] ${f.id}: ${msg}`))

    const body = f.body as { value?: unknown } | undefined
    if (body && Array.isArray(body.value)) {
      rewriteTree(body.value as MinimarkNode[], rewrite)
    }

    if (typeof f.cover === 'string') {
      return { ...file, cover: rewrite(f.cover) }
    }

    return file
  },
})
