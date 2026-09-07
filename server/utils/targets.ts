import type { H3Event } from 'h3'
import { queryCollection } from '@nuxt/content/server'

// 统计与评论表的 slug 列存的是「目标标识」：文章用裸 slug，页面用 page:<站内路径去掉开头的 />。
// 文章 slug 的字符集不含冒号，两者不会相撞。
const PAGE_PREFIX = 'page:'

// 页面路径由 @nuxt/content 从文件名 slugify 而来：小写，可含连字符、下划线与点。
const PAGE_SEGMENT = String.raw`[a-z0-9]+(?:[-_.][a-z0-9]+)*`
const PAGE_NAME_RE = new RegExp(`^${PAGE_SEGMENT}(?:/${PAGE_SEGMENT})*$`)

const knownPosts = new Set<string>()

export function pageTargetId(name: string) {
  return `${PAGE_PREFIX}${name}`
}

export function pageNameOf(target: string): string | null {
  return target.startsWith(PAGE_PREFIX) ? target.slice(PAGE_PREFIX.length) : null
}

export function pathToPageName(path: string) {
  return path.replace(/^\//, '')
}

export function requireSlug(event: H3Event) {
  const slug = String(getRouterParam(event, 'slug') ?? '').trim()
  if (!slug || slug.length > 120 || !/^[\w-]+$/.test(slug)) {
    throw httpError(400, '文章标识不合法')
  }
  return slug
}

export function requirePageName(event: H3Event) {
  const name = String(getRouterParam(event, 'name') ?? '').replace(/^\/+|\/+$/g, '')
  if (!name || name.length > 120 || !PAGE_NAME_RE.test(name)) {
    throw httpError(400, '页面标识不合法')
  }
  return name
}

export async function assertPostExists(event: H3Event, slug: string) {
  if (knownPosts.has(slug)) return

  const post = await queryCollection(event, 'blog')
    .where('slug', '=', slug)
    .where('draft', '=', false)
    .select('path')
    .first()

  if (!post) {
    throw httpError(404, '文章不存在')
  }

  knownPosts.add(slug)
}

// 不缓存：`comments` 开关随时可能在后台改掉，缓存会让旧状态一直生效。
async function findPage(event: H3Event, name: string) {
  return queryCollection(event, 'pages')
    .path(`/${name}`)
    .select('path', 'comments')
    .first()
}

export async function assertPageExists(event: H3Event, name: string) {
  if (!(await findPage(event, name))) {
    throw httpError(404, '页面不存在')
  }
}

export async function assertPageComments(event: H3Event, name: string) {
  const page = await findPage(event, name)
  if (!page) throw httpError(404, '页面不存在')
  if (page.comments !== true) throw httpError(403, '该页面未开启评论')
}
