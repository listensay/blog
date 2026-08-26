import { queryCollection } from '@nuxt/content/server'
import { isoDate } from '../../app/utils/date'
import { siteConfig } from '../../app/utils/site'
import { taxonomySlug } from '../../app/utils/taxonomy'

interface SitemapEntry {
  loc: string
  lastmod?: string
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

function taxonomyUrl(prefix: string, name: string) {
  const kind = prefix === 'categories' ? 'category' : 'tag'
  return `${siteConfig.url}/${prefix}/${taxonomySlug(name, kind)}`
}

function isoDay(input: string | Date | undefined) {
  return isoDate(input) || undefined
}

export default defineEventHandler(async (event) => {
  const posts = await queryCollection(event, 'blog')
    .where('draft', '=', false)
    .order('date', 'DESC')
    .select('title', 'path', 'date', 'category', 'tags')
    .all()

  const pages = await queryCollection(event, 'pages').select('path').all()

  const newest = isoDay(posts[0]?.date)

  const entries: SitemapEntry[] = [
    { loc: `${siteConfig.url}/`, lastmod: newest, priority: '1.0' },
    { loc: `${siteConfig.url}/blog`, lastmod: newest, priority: '0.9' },
    { loc: `${siteConfig.url}/categories`, lastmod: newest, priority: '0.6' },
    { loc: `${siteConfig.url}/tags`, lastmod: newest, priority: '0.6' },
  ]

  for (const page of pages) {
    if (page.path && page.path !== '/') {
      entries.push({ loc: `${siteConfig.url}${page.path}`, priority: '0.5' })
    }
  }

  for (const post of posts) {
    entries.push({ loc: `${siteConfig.url}${post.path}`, lastmod: isoDay(post.date), priority: '0.8' })
  }

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
