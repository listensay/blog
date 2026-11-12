import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { request as httpRequest } from 'node:http'
import { startDesktopServer } from '../server/desktop.ts'
import { resolveWorkspace } from '../server/paths.ts'

const adminRoot = path.resolve(import.meta.dirname, '..')
const root = await mkdtemp(path.join(tmpdir(), 'blog-admin-check-'))
const previousRoot = process.env.ADMIN_BLOG_ROOT
await cp(path.join(adminRoot, '../content'), path.join(root, 'content'), { recursive: true })
await mkdir(path.join(root, 'public/images'), { recursive: true })
await mkdir(path.join(root, 'app/utils'), { recursive: true })
await cp(path.join(adminRoot, '../app/utils/taxonomy.ts'), path.join(root, 'app/utils/taxonomy.ts'))
process.env.ADMIN_BLOG_ROOT = root
const server = await startDesktopServer({
  workspace: resolveWorkspace(adminRoot),
  frontendRoot: path.join(adminRoot, 'dist'),
  affineRoot: path.join(root, '.affine/web'),
})
try {
  const base = new URL(server.url).origin
  assert.equal((await fetch(`${base}/api/dashboard`)).status, 401)
  const bootstrap = await fetch(server.url, { redirect: 'manual' })
  assert.equal(bootstrap.status, 303)
  const cookie = bootstrap.headers.getSetCookie()[0]!.split(';')[0]!
  const request = (url: string, init: RequestInit = {}) =>
    fetch(url, { ...init, headers: { cookie, ...init.headers } })
  assert.equal(
    (await fetch(server.url, { redirect: 'manual' })).status,
    401,
    'bootstrap tokens are single use',
  )
  assert.equal(
    await new Promise<number | undefined>((resolve, reject) => {
      httpRequest(
        `${base}/api/dashboard`,
        { headers: { host: 'attacker.example', cookie } },
        (response) => {
          response.resume()
          resolve(response.statusCode)
        },
      )
        .on('error', reject)
        .end()
    }),
    403,
  )
  assert.equal(
    (await request(`${base}/api/dashboard`, { headers: { 'sec-fetch-site': 'cross-site' } }))
      .status,
    403,
  )
  for (const route of [
    '/api/dashboard',
    '/api/pages',
    '/api/links',
    '/api/nav',
    '/api/settings',
    '/api/images',
    '/api/affine',
  ]) {
    const response = await request(`${base}${route}`)
    assert.equal(response.status, 200, route)
    await response.json()
  }
  const state = await (await request(`${base}/api/affine`)).json()
  assert.equal(state.mode, 'source')
  assert.equal(state.ready, false)
  assert.equal(state.connection, undefined)
  for (const route of [
    '/api/workspace',
    '/api/projects',
    '/api/posts',
    '/api/post',
    '/api/page',
    '/api/post/translation',
    '/api/post/translation/ai',
    '/api/ai',
  ]) {
    for (const method of ['GET', 'POST', 'PUT', 'DELETE'])
      assert.equal((await request(`${base}${route}`, { method })).status, 404, `${method} ${route}`)
  }
  for (const method of ['POST', 'PUT', 'DELETE'])
    assert.equal((await request(`${base}/api/pages`, { method })).status, 404)
  console.log('✓ 后台数据可读，旧文章/页面/作品/AI 写入接口已移除')

  const eventsAbort = new AbortController()
  const events = await request(`${base}/api/events`, {
    signal: AbortSignal.any([eventsAbort.signal, AbortSignal.timeout(10000)]),
  })
  assert.equal(events.headers.get('content-type'), 'text/event-stream')
  const eventReader = events.body!.getReader()
  assert.match(new TextDecoder().decode((await eventReader.read()).value), /connected/)

  const linksFile = path.join(root, 'content/pages/links.md')
  const before = await readFile(linksFile, 'utf8')
  const response = await request(`${base}/api/links`, {
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
      await request(`${base}/api/events`, {
        headers: { origin: 'https://example.com' },
      })
    ).status,
    403,
  )
  console.log('✓ 内容写入后推送数据更新事件，事件订阅拒绝跨站访问')
  assert.ok(!page.body.includes('不能覆盖'))
  assert.ok(before.includes(page.title))
  const savedLinks = await readFile(linksFile, 'utf8')
  const emptyDraft = await request(`${base}/api/links`, {
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
      await request(`${base}/api/links`, {
        method: 'PUT',
        headers: { origin: 'https://example.com', 'content-type': 'application/json' },
        body: JSON.stringify({ friends: [] }),
      })
    ).status,
    403,
  )
  assert.equal((await request(`${base}/api/affine/export`)).status, 404)
  assert.equal((await request(`${base}/api/comments/session`)).status, 200)
  assert.equal((await request(`${base}/api/comments`)).status, 401)
  console.log('✓ 桌面会话隔离、旧迁移接口移除、评论登录保护')
} finally {
  await server.close()
  if (previousRoot === undefined) delete process.env.ADMIN_BLOG_ROOT
  else process.env.ADMIN_BLOG_ROOT = previousRoot
  await rm(root, { recursive: true, force: true })
}
