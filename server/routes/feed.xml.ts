import { queryCollection } from '@nuxt/content/server'
import { isoDateTime } from '../../app/utils/date'
import { siteConfig } from '../../app/utils/site'
import { pathLocale, localizedPath } from '../../app/utils/locale'
import englishMessages from '../../i18n/locales/en.json'

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export default defineEventHandler(async (event) => {
  const locale = pathLocale(getRequestURL(event).pathname)
  const posts = await queryCollection(event, locale === 'en' ? 'blogEn' : 'blog')
    .where('draft', '=', false)
    .order('date', 'DESC')
    .limit(20)
    .select('title', 'description', 'date', 'path')
    .all()

  const items = posts.map((post) => {
    const link = `${siteConfig.url}${post.path}`
    return [
      '<item>',
      `<title>${escapeXml(post.title)}</title>`,
      `<link>${escapeXml(link)}</link>`,
      `<guid isPermaLink="true">${escapeXml(link)}</guid>`,
      `<pubDate>${new Date(isoDateTime(post.date)).toUTCString()}</pubDate>`,
      `<description>${escapeXml(post.description ?? '')}</description>`,
      '</item>',
    ].join('')
  }).join('')

  const feed = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '<channel>',
    `<title>${escapeXml(siteConfig.title)}</title>`,
    `<link>${escapeXml(siteConfig.url + localizedPath('/', locale))}</link>`,
    `<description>${escapeXml(locale === 'en' ? englishMessages.site.description : siteConfig.description)}</description>`,
    `<language>${locale}</language>`,
    `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    items,
    '</channel>',
    '</rss>',
  ].join('')

  setHeader(event, 'content-type', 'application/rss+xml; charset=utf-8')
  return feed
})
