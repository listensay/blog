import { queryCollection } from '@nuxt/content/server'
import { isoDate } from '../../app/utils/date'
import { siteConfig } from '../../app/utils/site'
import { taxonomySlug } from '../../app/utils/taxonomy'
import { languageAlternates, localizedPath, type SiteLocale } from '../../app/utils/locale'

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

function taxonomyUrl(prefix: string, name: string, locale: SiteLocale) {
  const kind = prefix === 'categories' ? 'category' : 'tag'
  return `${siteConfig.url}${localizedPath(`/${prefix}/${taxonomySlug(name, kind)}`, locale)}`
}

function isoDay(input: string | Date | undefined) {
  return isoDate(input) || undefined
}

export default defineEventHandler(async (event) => {
  const [zhPosts, enPosts, zhPages, enPages] = await Promise.all([
    queryCollection(event, 'blog')
      .where('draft', '=', false)
      .order('date', 'DESC')
      .select('title', 'path', 'date', 'category', 'tags')
      .all(),
    queryCollection(event, 'blogEn')
      .where('draft', '=', false)
      .order('date', 'DESC')
      .select('title', 'path', 'date', 'category', 'tags')
      .all(),
    queryCollection(event, 'pages').select('path').all(),
    queryCollection(event, 'pagesEn').select('path').all(),
  ])

  const entries: SitemapEntry[] = []
  for (const { locale, posts, pages } of [
    { locale: 'zh-CN' as const, posts: zhPosts, pages: zhPages },
    { locale: 'en' as const, posts: enPosts, pages: enPages },
  ]) {
    const newest = isoDay(posts[0]?.date)

    entries.push(
      { loc: `${siteConfig.url}${localizedPath('/', locale)}`, lastmod: newest, priority: '1.0' },
      { loc: `${siteConfig.url}${localizedPath('/blog', locale)}`, lastmod: newest, priority: '0.9' },
      { loc: `${siteConfig.url}${localizedPath('/categories', locale)}`, lastmod: newest, priority: '0.6' },
      { loc: `${siteConfig.url}${localizedPath('/tags', locale)}`, lastmod: newest, priority: '0.6' },
    )

    for (const page of pages) {
      if (page.path && page.path !== localizedPath('/', locale)) {
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
      entries.push({ loc: taxonomyUrl('categories', name, locale), lastmod, priority: '0.5' })
    }
    for (const [name, lastmod] of tags) {
      entries.push({ loc: taxonomyUrl('tags', name, locale), lastmod, priority: '0.4' })
    }
  }

  const publishedPaths = entries.map(entry => new URL(entry.loc).pathname)
  const body = entries.map(e => [
    '<url>',
    `<loc>${escapeXml(e.loc)}</loc>`,
    ...languageAlternates(new URL(e.loc).pathname, publishedPaths).map(alternate =>
      `<xhtml:link rel="alternate" hreflang="${alternate.hreflang}" href="${escapeXml(siteConfig.url + alternate.path)}"/>`,
    ),
    e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : '',
    `<priority>${e.priority}</priority>`,
    '</url>',
  ].join('')).join('')

  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    body,
    '</urlset>',
  ].join('')
})
