import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { ContentGitSync } from '../server/git-sync.ts'
import { resolveWorkspace } from '../server/paths.ts'
import { startDesktopServer } from '../server/desktop.ts'

const exec = promisify(execFile)
const directory = await mkdtemp(path.join(tmpdir(), 'blog-git-sync-'))
const root = path.join(directory, 'blog')
const remote = path.join(directory, 'remote.git')
const adminRoot = path.resolve(import.meta.dirname, '..')
let sync: ContentGitSync | undefined
let server: Awaited<ReturnType<typeof startDesktopServer>> | undefined
const git = async (...args: string[]) => (await exec('git', args, { cwd: root })).stdout.trim()
const remoteGit = async (...args: string[]) =>
  (await exec('git', ['--git-dir', remote, ...args])).stdout.trim()
const waitFor = async (check: () => Promise<boolean>) => {
  const deadline = Date.now() + 15000
  while (!(await check())) {
    assert.ok(Date.now() < deadline, 'timed out waiting for Git sync')
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}

try {
  await mkdir(root)
  await cp(path.join(adminRoot, '../content'), path.join(root, 'content'), { recursive: true })
  await mkdir(path.join(root, 'public/images'), { recursive: true })
  await mkdir(path.join(root, 'app/utils'), { recursive: true })
  await cp(
    path.join(adminRoot, '../app/utils/taxonomy.ts'),
    path.join(root, 'app/utils/taxonomy.ts'),
  )
  await writeFile(path.join(root, '.gitignore'), '.affine/\n.env\n')
  await writeFile(path.join(root, 'code.ts'), 'original\n')
  await writeFile(path.join(root, 'public/images/old.png'), 'old')
  await git('init', '-b', 'main')
  await git('config', 'user.name', 'Admin Test')
  await git('config', 'user.email', 'admin-test@example.invalid')
  await git('config', 'commit.gpgSign', 'false')
  await git('add', '.')
  await git('commit', '-m', 'initial')
  await git('init', '--bare', remote)
  await git('remote', 'add', 'origin', remote)
  await git('push', '-u', 'origin', 'main')
  const ws = resolveWorkspace(path.join(root, 'admin'))
  sync = new ContentGitSync(ws, undefined, 80)
  const save = (file: string, text: string) =>
    sync!.save(async (files) => {
      const absolute = path.join(root, file)
      await mkdir(path.dirname(absolute), { recursive: true })
      await writeFile(absolute, text)
      files.push(absolute)
    })

  await writeFile(path.join(root, 'code.ts'), 'unrelated staged code\n')
  await git('add', 'code.ts')
  await writeFile(path.join(root, 'content/blog/unrelated.md'), 'unrelated content\n')
  await git('add', 'content/blog/unrelated.md')
  await writeFile(path.join(root, '.env'), 'PRIVATE_KEY=do-not-publish\n')
  await save('content/journals/2026-11-12.md', 'first\n')
  await save('content/journals/2026-11-12.md', 'latest\n')
  await save('public/affine-assets/图片 with spaces.png', 'image bytes')
  await sync.save(async (files) => {
    const file = path.join(root, 'public/images/old.png')
    await rm(file)
    files.push(file)
  })
  await waitFor(async () => (await sync!.readStatus()).phase === 'synced')
  assert.equal(await remoteGit('rev-list', '--count', 'main'), '2', 'debounce one commit')
  assert.equal(await remoteGit('show', 'main:content/journals/2026-11-12.md'), 'latest')
  assert.equal(
    await remoteGit('show', 'main:public/affine-assets/图片 with spaces.png'),
    'image bytes',
  )
  await assert.rejects(remoteGit('show', 'main:public/images/old.png'))
  assert.equal(await remoteGit('show', 'main:code.ts'), 'original')
  await assert.rejects(remoteGit('show', 'main:content/blog/unrelated.md'))
  assert.equal(await git('diff', '--cached', '--name-only'), 'code.ts\ncontent/blog/unrelated.md')
  assert.equal(await remoteGit('log', '-1', '--format=%s', 'main'), 'content: 更新博客内容')
  assert.ok(!(await remoteGit('ls-tree', '-r', '--name-only', 'main')).includes('.affine/'))
  assert.ok(!(await remoteGit('ls-tree', '-r', '--name-only', 'main')).includes('.env'))
  await writeFile(path.join(root, 'content/journals/2026-11-12.md'), 'staged then restored\n')
  await git('add', 'content/journals/2026-11-12.md')
  await save('content/journals/2026-11-12.md', 'latest\n')
  await sync.flush()
  assert.equal(await remoteGit('rev-list', '--count', 'main'), '2', 'no empty commits')
  console.log('✓ 连续保存合并提交、新增/修改/删除与附件推送、中文路径、无空提交、保留无关暂存文件')

  await git('remote', 'set-url', 'origin', path.join(directory, 'offline.git'))
  await save('content/journals/2026-11-12.md', 'offline edit\n')
  await assert.rejects(sync.flush(), /尚未推送/)
  const unpushed = await git('rev-parse', 'HEAD')
  assert.equal(await git('rev-list', '--count', 'HEAD'), '3')
  assert.equal((await sync.readStatus()).phase, 'error')
  assert.match(await readFile(path.join(root, '.affine/git-sync.json'), 'utf8'), /2026-11-12/)
  await sync.close()
  await git('remote', 'set-url', 'origin', remote)
  sync = new ContentGitSync(ws, undefined, 80)
  await waitFor(async () => (await sync!.readStatus()).phase === 'synced')
  assert.equal(
    await remoteGit('rev-parse', 'main'),
    unpushed,
    'restart retries the existing commit',
  )
  assert.equal(await git('rev-list', '--count', 'HEAD'), '3')
  console.log('✓ 失败时保存待推送记录，重启自动补推且不重复提交')

  // Hold one push open, then save another edit through the same service.
  const release = path.join(directory, 'release')
  const entered = path.join(directory, 'entered')
  const hook = path.join(remote, 'hooks/pre-receive')
  await writeFile(
    hook,
    `#!/bin/sh\ntouch '${entered}'\nwhile [ ! -f '${release}' ]; do sleep 0.05; done\n`,
    { mode: 0o755 },
  )
  await save('content/journals/2026-11-12.md', 'push in progress\n')
  const pushing = sync.flush()
  await waitFor(
    async () =>
      await readFile(entered).then(
        () => true,
        () => false,
      ),
  )
  await save('content/journals/2026-11-12.md', 'saved during push\n')
  await writeFile(release, '')
  await pushing
  await rm(hook)
  assert.equal(await remoteGit('show', 'main:content/journals/2026-11-12.md'), 'saved during push')
  assert.equal((await sync.readStatus()).phase, 'synced')
  console.log('✓ 推送期间继续保存，新修改按顺序补充提交和推送')

  const other = path.join(directory, 'other')
  await git('clone', '--branch', 'main', remote, other)
  const elsewhere = async (...args: string[]) => exec('git', args, { cwd: other })
  await elsewhere('config', 'user.name', 'Other Test')
  await elsewhere('config', 'user.email', 'other-test@example.invalid')
  await elsewhere('config', 'commit.gpgSign', 'false')
  await writeFile(path.join(other, 'remote.txt'), 'remote edit\n')
  await elsewhere('add', 'remote.txt')
  await elsewhere('commit', '-m', 'remote edit')
  await elsewhere('push', 'origin', 'main')
  const remoteHead = await remoteGit('rev-parse', 'main')
  await save('content/journals/2026-11-12.md', 'diverged edit\n')
  await assert.rejects(sync.flush(), /拉取并合并/)
  assert.equal(await remoteGit('rev-parse', 'main'), remoteHead, 'never force-push')
  await git('switch', '-c', 'another')
  await git('branch', '--set-upstream-to=origin/main')
  await assert.rejects(sync.flush(), /分支或远程配置已改变/)
  await git('switch', 'main')
  // The test's unrelated staged work is removed only in this temporary fixture before merging.
  await git('restore', '--staged', 'code.ts', 'content/blog/unrelated.md')
  await git('fetch', 'origin')
  await git('merge', '--no-edit', 'origin/main')
  await sync.flush()
  assert.equal(await remoteGit('show', 'main:content/journals/2026-11-12.md'), 'diverged edit')
  assert.equal(await remoteGit('show', 'main:remote.txt'), 'remote edit')
  console.log('✓ 远端分叉与切换分支时停止推送，合并后可重试')

  const beforeMissingUpstream = await git('rev-parse', 'HEAD')
  await git('branch', '--unset-upstream')
  await save('content/journals/2026-11-12.md', 'saved without upstream\n')
  await assert.rejects(sync.flush(), /未设置远程上游/)
  assert.equal(await git('rev-parse', 'HEAD'), beforeMissingUpstream)
  assert.match(
    await readFile(path.join(root, 'content/journals/2026-11-12.md'), 'utf8'),
    /saved without upstream/,
  )
  await git('branch', '--set-upstream-to=origin/main')
  await sync.flush()
  await writeFile(path.join(root, '.gitignore'), '.affine/\n.env\npublic/images/ignored.png\n')
  await save('public/images/ignored.png', 'ignored image')
  await assert.rejects(sync.flush(), /被 Git 忽略/)
  await git('restore', '--', '.gitignore')
  await sync.flush()
  assert.equal(await remoteGit('show', 'main:public/images/ignored.png'), 'ignored image')
  console.log('✓ 缺少上游和被忽略的内容显示具体错误，修复后可补推')
  await sync.close()
  sync = undefined

  server = await startDesktopServer({
    workspace: ws,
    frontendRoot: path.join(adminRoot, 'dist'),
    affineRoot: path.join(root, '.affine/web'),
  })
  const base = new URL(server.url).origin
  const boot = await fetch(server.url, { redirect: 'manual' })
  const cookie = boot.headers.getSetCookie()[0]!.split(';')[0]!
  const request = async (route: string, method = 'GET', value?: unknown) => {
    const response = await fetch(`${base}/api${route}`, {
      method,
      headers: { cookie, 'content-type': 'application/json' },
      ...(value === undefined ? {} : { body: JSON.stringify(value) }),
    })
    const data = await response.json()
    assert.equal(response.status, 200, JSON.stringify(data))
    return data
  }
  const invoke = (command: string, args: Record<string, unknown>) =>
    request('/affine-local/invoke', 'POST', { command, args })
  const settings = await request('/settings')
  settings.settings.site.title = 'Automatically pushed settings'
  settings.settings.profile.bio = 'Automatically pushed profile'
  await request('/settings', 'PUT', { settings: settings.settings })
  await request('/nav', 'PUT', {
    items: [{ label: '首页', to: '/', icon: 'home', color: '#5144b4' }],
  })
  await request('/links', 'PUT', { friends: [{ name: 'Example', url: 'https://example.com' }] })
  for (const kind of ['post', 'page', 'journal', 'project']) {
    const docId = `new-${kind}`
    const documentRevision = await invoke('notes_store_request', {
      request: { op: 'push', space: 'local:workspace:test', id: docId, bin: [1] },
    })
    await invoke('blog_publish', {
      workspaceId: 'test',
      docId,
      documentRevision,
      title: `${kind} 标题`,
      markdown: `正文 ${kind}\n\n![图片](assets/photo.png)`,
      metadata: {
        kind,
        slug: `new-${kind}`,
        date: '2026-11-13',
        draft: false,
        category: '随笔',
        tags: [],
      },
      ...(kind === 'journal' ? { journalDate: '2026-11-13' } : {}),
      assets: [
        {
          name: 'assets/photo.png',
          mime: 'image/png',
          data: Buffer.from('published image').toString('base64'),
        },
      ],
    })
  }
  const uploaded = await fetch(`${base}/api/images?name=upload.png`, {
    method: 'POST',
    headers: { cookie },
    body: Buffer.from('image bytes'),
  })
  assert.equal(uploaded.status, 201)
  await uploaded.json()
  await request('/git/flush', 'POST', {})
  assert.equal((await request('/git/status')).phase, 'synced')
  assert.match(
    await remoteGit('show', 'main:content/data/site.json'),
    /Automatically pushed settings/,
  )
  assert.match(await remoteGit('show', 'main:content/data/nav.json'), /首页/)
  assert.match(await remoteGit('show', 'main:content/pages/links.md'), /Example/)
  const published = await remoteGit('ls-tree', '-r', '--name-only', 'main')
  for (const file of [
    'content/blog/new-post.md',
    'content/pages/new-page.md',
    'content/journals/2026-11-13.md',
    'content/data/projects.json',
    'public/images/upload.png',
  ])
    assert.ok(published.includes(file), file)
  assert.match(published, /public\/affine-assets\/[a-f0-9]+\.png/)
  await request('/images/cleanup', 'POST', { names: ['upload.png'] })
  await request('/git/flush', 'POST', {})
  await assert.rejects(remoteGit('show', 'main:public/images/upload.png'))
  const before = await remoteGit('rev-parse', 'main')
  await invoke('notes_store_request', {
    request: { op: 'push', space: 'local:workspace:test', id: 'private-draft', bin: [1] },
  })
  await request('/git/flush', 'POST', {})
  assert.equal(
    await remoteGit('rev-parse', 'main'),
    before,
    'private editor storage does not publish',
  )
  const invalid = await fetch(`${base}/api/settings`, {
    method: 'PUT',
    headers: { cookie, 'content-type': 'application/json' },
    body: '{}',
  })
  assert.equal(invalid.status, 400)
  await invalid.json()
  await request('/git/flush', 'POST', {})
  assert.equal(await remoteGit('rev-parse', 'main'), before)
  console.log(
    '✓ 后台接口覆盖文章、页面、日记、作品、设置、社交资料、菜单、友链、图片上传与清理；未发布草稿及无效保存不触发提交',
  )
} finally {
  await writeFile(path.join(directory, 'release'), '').catch(() => {})
  await sync?.close()
  await server?.close()
  await rm(directory, { recursive: true, force: true })
}
