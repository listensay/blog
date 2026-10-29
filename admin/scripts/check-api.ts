import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'

const adminRoot = path.resolve(import.meta.dirname, '..')
const root = await mkdtemp(path.join(tmpdir(), 'blog-admin-check-'))
const previousRoot = process.env.ADMIN_BLOG_ROOT
await cp(path.join(adminRoot, '../content'), path.join(root, 'content'), { recursive: true })
await mkdir(path.join(root, 'public/images'), { recursive: true })
await mkdir(path.join(root, 'app/utils'), { recursive: true })
await cp(path.join(adminRoot, '../app/utils/taxonomy.ts'), path.join(root, 'app/utils/taxonomy.ts'))
process.env.ADMIN_BLOG_ROOT = root
const server = await createServer({
  root: adminRoot,
  configFile: path.join(adminRoot, 'vite.config.ts'),
  logLevel: 'silent',
  server: { port: 0, host: '127.0.0.1', ws: false },
})
try {
  await server.listen()
  const address = server.httpServer!.address()
  assert.ok(address && typeof address === 'object')
  const base = `http://127.0.0.1:${address.port}`
  for (const route of [
    '/api/workspace',
    '/api/dashboard',
    '/api/pages',
    '/api/links',
    '/api/nav',
    '/api/settings',
    '/api/projects',
    '/api/images',
    '/api/affine',
  ]) {
    const response = await fetch(`${base}${route}`)
    assert.equal(response.status, 200, route)
    await response.json()
  }
  const state = await (await fetch(`${base}/api/affine`)).json()
  assert.equal(state.mode, 'source')
  assert.equal(state.ready, false)
  assert.equal(state.connection, undefined)
  for (const route of [
    '/api/posts',
    '/api/post',
    '/api/page',
    '/api/post/translation',
    '/api/post/translation/ai',
    '/api/ai',
  ]) {
    for (const method of ['GET', 'POST', 'PUT', 'DELETE'])
      assert.equal((await fetch(`${base}${route}`, { method })).status, 404, `${method} ${route}`)
  }
  for (const method of ['POST', 'PUT', 'DELETE'])
    assert.equal((await fetch(`${base}/api/pages`, { method })).status, 404)
  for (const method of ['POST', 'PUT', 'DELETE'])
    assert.equal((await fetch(`${base}/api/projects`, { method })).status, 404)
  console.log('✓ 后台数据可读，旧文章/页面/作品/AI 写入接口已移除')

  const eventsAbort = new AbortController()
  const events = await fetch(`${base}/api/events`, {
    signal: AbortSignal.any([eventsAbort.signal, AbortSignal.timeout(10000)]),
  })
  assert.equal(events.headers.get('content-type'), 'text/event-stream')
  const eventReader = events.body!.getReader()
  assert.match(new TextDecoder().decode((await eventReader.read()).value), /connected/)

  const linksFile = path.join(root, 'content/pages/links.md')
  const before = await readFile(linksFile, 'utf8')
  const response = await fetch(`${base}/api/links`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      friends: [{ name: 'Example', url: 'https://example.com' }],
      body: '不能覆盖页面正文',
      title: '不能覆盖标题',
    }),
  })
  assert.equal(response.status, 200)
  const page = await response.json()
  assert.equal(page.friends.length, 1)
  try {
    assert.match(new TextDecoder().decode((await eventReader.read()).value), /data: changed/)
  } finally {
    await eventReader.cancel()
    eventsAbort.abort()
  }
  assert.equal(
    (
      await fetch(`${base}/api/events`, {
        headers: { origin: 'https://example.com' },
      })
    ).status,
    403,
  )
  console.log('✓ 内容写入后推送数据更新事件，事件订阅拒绝跨站访问')
  assert.ok(!page.body.includes('不能覆盖'))
  assert.ok(before.includes(page.title))
  const savedLinks = await readFile(linksFile, 'utf8')
  const emptyDraft = await fetch(`${base}/api/links`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ friends: [{ name: '', url: '', description: '' }] }),
  })
  assert.equal(emptyDraft.status, 400, 'empty draft rows must not disappear after autosave')
  assert.equal(
    await readFile(linksFile, 'utf8'),
    savedLinks,
    'incomplete drafts preserve saved links',
  )
  assert.equal(
    (
      await fetch(`${base}/api/links`, {
        method: 'PUT',
        headers: { origin: 'https://example.com', 'content-type': 'application/json' },
        body: JSON.stringify({ friends: [] }),
      })
    ).status,
    403,
  )
  const archive = await fetch(`${base}/api/affine/export`)
  assert.equal(archive.status, 200)
  assert.equal(archive.headers.get('content-type'), 'application/zip')
  assert.ok((await archive.arrayBuffer()).byteLength > 100)
  console.log('✓ 友链仅修改友链数据，拒绝跨站写入，迁移包可下载')

  for (const route of [
    '/src/views/AffineView.vue',
    '/src/App.vue',
    '/src/router/index.ts',
    '/src/views/LinkView.vue',
  ]) {
    const response = await fetch(`${base}${route}`)
    assert.equal(response.status, 200, route)
  }
  console.log('✓ AFFiNE 管理页面与导航经 Vite 编译通过')
} finally {
  await server.close()
  if (previousRoot === undefined) delete process.env.ADMIN_BLOG_ROOT
  else process.env.ADMIN_BLOG_ROOT = previousRoot
  await rm(root, { recursive: true, force: true })
}
