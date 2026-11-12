import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { once } from 'node:events'
import { cp, mkdtemp, mkdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createInterface } from 'node:readline'

const admin = path.resolve(import.meta.dirname, '..')
const [runtimePath, resourcesPath] = process.argv.slice(2)
const resources = resourcesPath
  ? path.resolve(resourcesPath)
  : path.join(admin, 'src-tauri/resources')
const target = runtimePath
  ? undefined
  : execFileSync('rustc', ['-vV'], { encoding: 'utf8' }).match(/^host: (.+)$/m)?.[1]
const runtime = runtimePath
  ? path.resolve(runtimePath)
  : path.join(
      admin,
      `src-tauri/binaries/blog-node-${target}${process.platform === 'win32' ? '.exe' : ''}`,
    )
const root = await mkdtemp(path.join(tmpdir(), 'blog-desktop-check-'))
const children = new Set()

async function start() {
  const child = spawn(runtime, [path.join(resources, 'service.mjs'), root, resources], {
    cwd: root,
    env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '', PATH: '' },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  children.add(child)
  const exited = once(child, 'exit')
  let stderr = ''
  child.stderr.on('data', (data) => {
    stderr += data
  })
  const lines = createInterface({ input: child.stdout })
  const line = await Promise.race([
    once(lines, 'line', { signal: AbortSignal.timeout(15_000) }).then(([line]) => line),
    exited.then(() => {
      throw new Error(`桌面服务启动失败：${stderr}`)
    }),
  ])
  const url = JSON.parse(line).url
  const origin = new URL(url).origin
  assert.equal(new URL(url).hostname, '127.0.0.1')
  const bootstrap = await fetch(url, { redirect: 'manual' })
  assert.equal(bootstrap.status, 303)
  const cookie = bootstrap.headers.getSetCookie()[0].split(';')[0]
  return {
    origin,
    cookie,
    request(route, init = {}) {
      return fetch(`${origin}${route}`, { ...init, headers: { cookie, ...init.headers } })
    },
    async stop() {
      child.stdin.end()
      const [code] = await Promise.race([
        exited,
        once(AbortSignal.timeout(10_000), 'abort').then(() => {
          throw new Error('桌面服务未正常退出')
        }),
      ])
      assert.equal(code, 0, stderr)
      children.delete(child)
      lines.close()
    },
  }
}

try {
  await cp(path.join(admin, '../content'), path.join(root, 'content'), { recursive: true })
  await mkdir(path.join(root, 'public/images'), { recursive: true })
  await mkdir(path.join(root, 'app/utils'), { recursive: true })
  await cp(path.join(admin, '../app/utils/taxonomy.ts'), path.join(root, 'app/utils/taxonomy.ts'))

  const first = await start()
  assert.equal((await fetch(`${first.origin}/api/settings`)).status, 401)
  for (const route of ['/', '/settings/system', '/affine-workspace/']) {
    const response = await first.request(route)
    assert.equal(response.status, 200, route)
    assert.match(response.headers.get('content-type'), /text\/html/)
    const html = await response.text()
    assert.match(html, /<html/i)
    if (route === '/') {
      const script = html.match(/<script[^>]+src="([^"]+)"/)[1]
      const asset = await first.request(script)
      assert.equal(asset.status, 200)
      assert.match(asset.headers.get('content-type'), /javascript/)
    }
  }
  const affine = await (await first.request('/api/affine')).json()
  assert.equal(affine.ready, true, 'editor assets come from the application resources')
  const settings = await (await first.request('/api/settings')).json()
  settings.settings.site.title = 'Desktop persistence check'
  const saved = await first.request('/api/settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ settings: settings.settings }),
  })
  assert.equal(saved.status, 200)
  await saved.arrayBuffer()
  const events = await first.request('/api/events')
  const reader = events.body.getReader()
  assert.match(new TextDecoder().decode((await reader.read()).value), /connected/)
  await first.stop()
  await reader.cancel().catch(() => {})

  const second = await start()
  assert.notEqual(second.cookie, first.cookie)
  assert.equal(
    (await second.request('/api/settings', { headers: { cookie: first.cookie } })).status,
    401,
  )
  const restored = await (await second.request('/api/settings')).json()
  assert.equal(restored.settings.site.title, 'Desktop persistence check')
  assert.equal(
    JSON.parse(await readFile(path.join(root, 'content/data/site.json'), 'utf8')).site.title,
    'Desktop persistence check',
  )
  await second.stop()
  console.log('✓ 内置 Node 独立启动、前端与编辑器资源、设置落盘、重启会话隔离及退出清理')
} finally {
  for (const child of children) {
    if (!child.pid || child.exitCode !== null || child.signalCode !== null) continue
    const exited = once(child, 'exit')
    child.kill()
    await exited
  }
  await rm(root, { recursive: true, force: true })
}
