import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// Check rendered HTML without JavaScript, as a crawler would see it.
const base = process.argv[2] || 'http://127.0.0.1:3000'
const { site } = JSON.parse(await readFile(new URL('../content/data/site.json', import.meta.url), 'utf8'))
const origin = site.url.replace(/\/+$/, '')
const pairedPaths = ['/', '/blog', '/categories', '/tags', '/about', '/links', '/categories/benefits', '/tags/ai', '/tags/freebies', '/blog/ai/free-ai']
const enPath = path => path === '/' ? '/en' : `/en${path}`
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]))
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map(([tag]) => attributes(tag))

async function get(path, expectedStatus = 200) {
  const response = await fetch(new URL(path, base), { headers: { accept: 'text/html' } })
  assert.equal(response.status, expectedStatus, `${path}: HTTP status`)
  return response.text()
}

for (const path of pairedPaths) {
  for (const [locale, current] of [['zh-CN', path], ['en', enPath(path)]]) {
    const html = await get(current)
    const head = html.split('</head>')[0]
    const links = tags(head, 'link')
    assert.equal(tags(html, 'html')[0].lang, locale, `${current}: HTML language`)
    assert.deepEqual(links.filter(link => link.rel === 'canonical').map(link => link.href), [origin + current], `${current}: self canonical`)
    assert.deepEqual(links.filter(link => link.hreflang).map(({ hreflang, href }) => [hreflang, href]).sort(), [
      ['en', origin + enPath(path)], ['zh-CN', origin + path],
    ], `${current}: reciprocal language links`)
    const header = html.match(/<header\b[\s\S]*?<\/header>/)?.[0] || ''
    const toggle = tags(header, 'a').find(link => link.hreflang)
    assert.equal(toggle?.href, locale === 'en' ? path : enPath(path), `${current}: header language switch`)
    assert.ok(!tags(head, 'meta').some(meta => meta.name === 'robots' && meta.content.includes('noindex')), `${current}: indexable`)

    if (path === '/blog/ai/free-ai') {
      const json = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
        .map(([, data]) => JSON.parse(data)).find(data => data['@type'] === 'BlogPosting')
      assert.equal(json?.inLanguage, locale, `${current}: structured data language`)
      assert.equal(json?.mainEntityOfPage['@id'], origin + current, `${current}: structured data URL`)
      const article = html.match(/<article\b[\s\S]*?<\/article>/)?.[0] || ''
      assert.ok(article.includes(locale === 'en' ? 'Community AI API gateways' : '公益中转站'), `${current}: server-rendered article body`)
      assert.equal(tags(head, 'meta').find(meta => meta.property === 'og:locale')?.content, locale === 'en' ? 'en_US' : 'zh_CN')
    }
  }
}

const originalOnly = '/blog/ai/ai-logo-generation'
const untranslated = await get(originalOnly)
assert.equal(tags(untranslated.split('</head>')[0], 'link').filter(link => link.hreflang).length, 0, 'No hreflang for missing translations')
const untranslatedHeader = untranslated.match(/<header\b[\s\S]*?<\/header>/)?.[0] || ''
assert.equal(tags(untranslatedHeader, 'a').find(link => link.hreflang)?.href, '/en/blog', 'Untranslated articles switch to the English article list')
const missing = await get(enPath(originalOnly), 404)
assert.ok(tags(missing, 'meta').some(meta => meta.name === 'robots' && meta.content.includes('noindex')), 'Missing translations are not indexable')
assert.equal(tags(missing, 'link').filter(link => link.rel === 'canonical').length, 0, '404 pages have no canonical')

const listing = await get('/en/blog')
const main = listing.match(/<main\b[\s\S]*?<\/main>/)?.[0] || ''
assert.ok(tags(main, 'a').some(link => link.href === '/en/blog/ai/free-ai'), 'English article is discoverable')
assert.ok(!tags(main, 'a').some(link => link.href === originalOnly), 'English listing excludes untranslated posts')

const sitemap = await get('/sitemap.xml')
assert.ok(sitemap.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"'))
for (const path of pairedPaths.flatMap(path => [path, enPath(path)])) {
  const entry = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].find(([, value]) => value.includes(`<loc>${origin}${path}</loc>`))?.[1]
  assert.ok(entry, `${path}: present in sitemap`)
  assert.equal(tags(entry, 'xhtml:link').length, 2, `${path}: sitemap language links`)
}
assert.ok(!sitemap.includes(origin + enPath(originalOnly)), 'Missing translation excluded from sitemap')
assert.ok(!sitemap.includes('/admin'), 'Admin excluded from sitemap')
assert.ok((await get('/en/feed.xml')).includes('<language>en</language>'), 'English RSS')
assert.ok((await get('/feed.xml')).includes('<language>zh-CN</language>'), 'Chinese RSS')

console.log('Locale checks passed: rendered content, navigation, canonical, hreflang, structured data, sitemap, RSS, and missing translations.')
