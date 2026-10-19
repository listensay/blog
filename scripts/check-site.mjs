import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { escapeHtml } from '@vue/shared'

// Verify server-rendered content and indexing without relying on browser JavaScript.
const base = process.argv[2] || 'http://localhost:3000'
const { site } = JSON.parse(await readFile(new URL('../content/data/site.json', import.meta.url), 'utf8'))
const menu = JSON.parse(await readFile(new URL('../content/data/nav.json', import.meta.url), 'utf8'))
const origin = site.url.replace(/\/+$/, '')
const articles = {
  '/blog/ai/free-ai': '公益中转站',
  '/blog/ai/ai-logo-generation': '前提准备',
  '/blog/other/codehack-jetbrains': '先打开这个网址',
}
const paths = ['/', '/blog', '/journals', '/projects', '/categories', '/tags', '/about', '/links', '/categories/benefits', '/tags/ai', ...Object.keys(articles)]
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]))
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map(([tag]) => attributes(tag))
async function get(path, expectedStatus = 200) {
  const response = await fetch(new URL(path, base), { headers: { accept: 'text/html' }, redirect: 'manual', signal: AbortSignal.timeout(30000) })
  assert.equal(response.status, expectedStatus, `${path}: HTTP status`)
  return response.text()
}
for (const path of paths) {
  const html = await get(path)
  const head = html.split('</head>')[0]
  assert.equal(tags(html, 'html')[0].lang, 'zh-CN', `${path}: Chinese document`)
  assert.deepEqual(tags(head, 'link').filter(link => link.rel === 'canonical').map(link => link.href), [origin + path], `${path}: canonical`)
  assert.ok(!tags(head, 'link').some(link => link.hreflang), `${path}: no translated alternate pages`)
  const header = html.match(/<header\b[\s\S]*?<\/header>/)?.[0] || ''
  const navigation = header.match(/<nav\b[\s\S]*?<\/nav>/)?.[0] || ''
  const labels = [...navigation.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)].map(([, label]) => label.replace(/<[^>]*>/g, '').trim())
  assert.deepEqual(labels, menu.map(item => escapeHtml(item.label.trim())), `${path}: configured menu`)
  assert.ok(!/Language|English|切换语言/.test(header), `${path}: no language menu`)
  assert.ok(!tags(html, 'a').some(link => /^\/en(?:\/|$|[?#])/.test(link.href)), `${path}: no English links`)
  if (path in articles) {
    const article = html.match(/<article\b[\s\S]*?<\/article>/)?.[0] || ''
    assert.ok(article.includes(articles[path]), `${path}: original Chinese body`)
    const json = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(([, data]) => JSON.parse(data)).find(data => data['@type'] === 'BlogPosting')
    assert.equal(json?.inLanguage, 'zh-CN', `${path}: structured data language`)
    assert.equal(json?.mainEntityOfPage['@id'], origin + path, `${path}: structured data URL`)
  }
}
for (const path of paths.map(path => path === '/' ? '/en' : `/en${path}`).concat('/en/feed.xml', '/en/journals/2026-10-19')) {
  const html = await get(path, 404)
  assert.ok(tags(html, 'meta').some(meta => meta.name === 'robots' && meta.content.includes('noindex')), `${path}: missing page not indexed`)
  assert.ok(!tags(html, 'link').some(link => link.rel === 'canonical'), `${path}: missing page has no canonical`)
}
const sitemap = await get('/sitemap.xml')
assert.ok(!/hreflang|xmlns:xhtml/.test(sitemap))
const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(([, loc]) => loc)
for (const path of paths) assert.ok(locations.includes(origin + path), `${path}: in sitemap`)
assert.ok(!locations.some(loc => /^\/en(?:\/|$)/.test(new URL(loc).pathname)), 'sitemap excludes English')
assert.ok(!sitemap.includes('/admin'), 'admin excluded')
const feed = await get('/feed.xml')
assert.ok(feed.includes('<language>zh-CN</language>'))
assert.ok(!feed.includes(`${origin}/en/`), 'RSS excludes English')
// If journals exist, verify their detail pages as well; an empty diary remains a valid state.
for (const loc of locations.filter(loc => /\/journals\/\d{4}-\d{2}-\d{2}$/.test(loc))) {
  assert.ok((await get(new URL(loc).pathname)).includes('<article'), `${loc}: readable journal`)
}
console.log('站点检查通过：中文页面、菜单、正文、日记、canonical、RSS、站点地图及英文地址 404。')
