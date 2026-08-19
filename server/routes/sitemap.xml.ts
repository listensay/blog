/**
 * 站点地图：/sitemap.xml
 *
 * 和 feed.xml 同一套写法（直接查 @nuxt/content、同样的 draft 过滤），
 * 但覆盖面更全：首页、固定页、文章、以及由文章聚合出来的分类页和标签页。
 * robots.txt 里指向这里。
 */
import { queryCollection } from '@nuxt/content/server'
import { siteConfig } from '../../app/utils/site'

interface SitemapEntry {
  loc: string
  lastmod?: string
  /** 相对权重，只是给爬虫的提示 */
  priority: string
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

/** 中文分类/标签的 URL 必须 percent-encode，和站内 NuxtLink 的写法保持一致 */
function taxonomyUrl(prefix: string, name: string) {
  return `${siteConfig.url}/${prefix}/${encodeURIComponent(name)}`
}

function isoDay(input: string | Date | undefined) {
  if (!input) return undefined
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10)
}

export default defineEventHandler(async (event) => {
  const posts = await queryCollection(event, 'blog')
    .where('draft', '=', false)
    .order('date', 'DESC')
    .select('title', 'path', 'date', 'category', 'tags')
    .all()

  // 最新一篇的日期当作列表页的 lastmod —— 列表页内容就是随它变的
  const newest = isoDay(posts[0]?.date)

  const entries: SitemapEntry[] = [
    // 尾斜杠是刻意的：和首页 canonical（siteConfig.url + '/'）保持一字不差
    { loc: `${siteConfig.url}/`, lastmod: newest, priority: '1.0' },
    { loc: `${siteConfig.url}/blog`, lastmod: newest, priority: '0.9' },
    { loc: `${siteConfig.url}/categories`, lastmod: newest, priority: '0.6' },
    { loc: `${siteConfig.url}/tags`, lastmod: newest, priority: '0.6' },
    { loc: `${siteConfig.url}/about`, priority: '0.5' },
    { loc: `${siteConfig.url}/links`, priority: '0.3' },
  ]

  for (const post of posts) {
    entries.push({ loc: `${siteConfig.url}${post.path}`, lastmod: isoDay(post.date), priority: '0.8' })
  }

  // 分类页/标签页的 lastmod = 该分类或标签下最新一篇的日期。
  // posts 已按日期倒序，所以第一次见到的就是最新的。
  const categories = new Map<string, string | undefined>()
  const tags = new Map<string, string | undefined>()
  for (const post of posts) {
    const day = isoDay(post.date)
    if (post.category && !categories.has(post.category)) categories.set(post.category, day)
    for (const tag of post.tags ?? []) {
      if (!tags.has(tag)) tags.set(tag, day)
    }
  }
  for (const [name, lastmod] of categories) {
    entries.push({ loc: taxonomyUrl('categories', name), lastmod, priority: '0.5' })
  }
  for (const [name, lastmod] of tags) {
    entries.push({ loc: taxonomyUrl('tags', name), lastmod, priority: '0.4' })
  }

  const body = entries.map(e => [
    '<url>',
    `<loc>${escapeXml(e.loc)}</loc>`,
    e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : '',
    `<priority>${e.priority}</priority>`,
    '</url>',
  ].join('')).join('')

  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    '</urlset>',
  ].join('')
})
