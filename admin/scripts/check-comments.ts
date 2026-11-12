import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { CommentAdmin } from '../server/comments.ts'
import { resolveWorkspace } from '../server/paths.ts'

const root = await mkdtemp(path.join(tmpdir(), 'blog-comments-'))
await mkdir(path.join(root, 'content/blog'), { recursive: true })
await mkdir(path.join(root, 'public'), { recursive: true })
const client = new CommentAdmin(resolveWorkspace(path.join(root, 'admin'), root))
const requests: { method: string; url: string; cookie?: string }[] = []
let responseStatus = 200
const server = createServer(async (request, response) => {
  requests.push({ method: request.method!, url: request.url!, cookie: request.headers.cookie })
  response.setHeader('content-type', 'application/json')
  if (request.url === '/api/admin/login') {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(chunk as Buffer)
    assert.equal(JSON.parse(Buffer.concat(chunks).toString()).password, 'test-password')
    response.setHeader('set-cookie', 'blog_admin=test-session; Path=/; HttpOnly')
    response.end('{"ok":true}')
  } else if (request.url === '/api/admin/session') {
    response.end(JSON.stringify({ authed: request.headers.cookie === 'blog_admin=test-session' }))
  } else {
    response.statusCode = responseStatus
    response.end(
      JSON.stringify(responseStatus === 200 ? { ok: true } : { statusMessage: '需要先登录' }),
    )
  }
})
try {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const site = `http://127.0.0.1:${address.port}`
  await assert.rejects(client.list('all', '0'), /请先登录/)
  for (const invalid of [
    'http://example.com',
    'file:///tmp',
    `${site}/other`,
    `${site}/?token=1`,
  ]) {
    await assert.rejects(client.login({ site: invalid, password: 'test-password' }), /站点地址/)
  }
  const session = await client.login({ site, password: 'test-password' })
  assert.deepEqual(session, { site, authed: true })
  assert.ok(!JSON.stringify(session).includes('test-session'))
  await client.list('hidden', '50')
  assert.equal(requests.at(-1)?.url, '/api/admin/comments?status=hidden&limit=50&offset=50')
  assert.equal(requests.at(-1)?.cookie, 'blog_admin=test-session')
  const id = '12345678-1234-1234-1234-123456789012'
  for (const action of ['hide', 'restore', 'purge']) await client.act({ id, action })
  assert.deepEqual(
    requests.slice(-3).map((r) => [r.method, r.url]),
    [
      ['DELETE', `/api/admin/comments/${id}`],
      ['POST', `/api/admin/comments/${id}/restore`],
      ['DELETE', `/api/admin/comments/${id}?purge=1`],
    ],
  )
  await assert.rejects(client.act({ id: '../settings', action: 'purge' }), /标识/)
  responseStatus = 401
  await assert.rejects(client.list('all', '0'), /需要先登录/)
  assert.deepEqual(await client.session(), { site, authed: false })
  responseStatus = 200
  await client.login({ site, password: 'test-password' })
  await client.logout()
  await assert.rejects(client.list('all', '0'), /请先登录/)
  console.log('✓ 评论登录与会话隔离、分页、隐藏/恢复/永久删除、过期会话与地址校验')
} finally {
  client.close()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await rm(root, { recursive: true, force: true })
}
