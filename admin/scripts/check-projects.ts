import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'
import { blogAdminApi } from '../server/blog-api.ts'
import { publishedProjects } from '../../server/utils/projects.ts'
import { findUnusedImages } from '../server/images.ts'
import { resolveWorkspace } from '../server/paths.ts'
import type { Project, ProjectsResponse } from '../../app/types/project.ts'

const root = await mkdtemp(path.join(tmpdir(), 'blog-projects-check-'))
const previousRoot = process.env.ADMIN_BLOG_ROOT
const adminRoot = path.join(root, 'admin')
for (const dir of ['content/blog', 'content/pages', 'public/images', 'admin']) {
  await mkdir(path.join(root, dir), { recursive: true })
}
process.env.ADMIN_BLOG_ROOT = root
const server = await createServer({
  root: adminRoot,
  configFile: false,
  plugins: [blogAdminApi()],
  logLevel: 'silent',
  server: { port: 0, host: '127.0.0.1', ws: false },
})

try {
  await server.listen()
  const address = server.httpServer!.address()
  assert.ok(address && typeof address === 'object')
  const base = `http://127.0.0.1:${address.port}`
  const file = path.join(root, 'content/data/projects.json')
  const call = async (method: string, body?: unknown) => {
    const response = await fetch(`${base}/api/projects`, {
      method,
      headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    return {
      status: response.status,
      data: (await response.json()) as ProjectsResponse & { error?: string },
    }
  }
  const initial = await call('GET')
  assert.equal(initial.status, 200)
  assert.deepEqual(initial.data.items, [])
  const project: Project = {
    id: 'project-a',
    title: ' 项目 A ',
    titleEn: 'Project A',
    description: '项目简介',
    descriptionEn: 'An example project.',
    cover: '/images/portfolio-cover.png',
    tags: ['Vue', ' TypeScript ', 'Vue'],
    demoUrl: 'https://example.com/demo',
    repoUrl: 'https://github.com/example/project',
    draft: true,
  }
  const created = await call('PUT', { items: [project], revision: initial.data.revision })
  assert.equal(created.status, 200)
  assert.equal(created.data.items[0]?.title, '项目 A')
  assert.deepEqual(created.data.items[0]?.tags, ['Vue', 'TypeScript'])
  assert.deepEqual(publishedProjects(created.data.items), [], '草稿不进入公开数据')
  assert.deepEqual((await call('GET')).data, created.data, '保存后重新读取一致')

  const second = { ...created.data.items[0]!, id: 'project-b', title: '项目 B', draft: false }
  const reordered = await call('PUT', {
    items: [second, { ...created.data.items[0]!, draft: false }],
    revision: created.data.revision,
  })
  assert.equal(reordered.status, 200)
  assert.deepEqual(
    reordered.data.items.map((item) => item.id),
    ['project-b', 'project-a'],
  )
  const publicItems = publishedProjects(reordered.data.items)
  assert.deepEqual(
    publicItems.map((item) => item.id),
    ['project-b', 'project-a'],
    '发布顺序与管理顺序一致',
  )
  assert.equal(publicItems[0]?.titleEn, 'Project A')
  assert.ok(
    publicItems.every((item) => !('draft' in item)),
    '公开响应不包含管理字段',
  )
  assert.deepEqual(
    publishedProjects([{ ...second, draft: undefined } as unknown as Project]),
    [],
    '缺少发布状态时默认不公开',
  )

  const before = await readFile(file, 'utf8')
  for (const patch of [
    { title: '' },
    { id: '../bad' },
    { draft: 'false' },
    { tags: [123] },
    { titleEn: 3 },
    { description: 'x'.repeat(1001) },
    { tags: ['x'.repeat(41)] },
    { demoUrl: 'javascript:alert(1)' },
    { repoUrl: '//evil.example' },
    { cover: '/\\evil.example' },
    { demoUrl: 'https://example.com/\nfoo' },
    { repoUrl: 'https://user:password@example.com/' },
    { cover: 'data:image/svg+xml,abc' },
  ]) {
    const invalid = await call('PUT', {
      items: [{ ...second, ...patch }],
      revision: reordered.data.revision,
    })
    assert.equal(invalid.status, 400, JSON.stringify(patch))
    assert.equal(await readFile(file, 'utf8'), before, '校验失败不修改文件')
  }
  for (const body of [
    null,
    [],
    {},
    { items: [second, second], revision: reordered.data.revision },
  ]) {
    assert.equal((await call('PUT', body)).status, 400)
  }
  assert.equal(
    (await call('PUT', { items: [], revision: initial.data.revision })).status,
    409,
    '旧窗口不能覆盖新数据',
  )

  const concurrent = await Promise.all([
    call('PUT', {
      items: [second, { ...project, draft: true }],
      revision: reordered.data.revision,
    }),
    call('PUT', {
      items: [second, { ...project, title: '另一个窗口' }],
      revision: reordered.data.revision,
    }),
  ])
  assert.deepEqual(
    concurrent.map((result) => result.status).sort(),
    [200, 409],
    '并发保存只有一个成功',
  )
  const latest = (await call('GET')).data
  assert.deepEqual(
    publishedProjects(latest.items).map((item) => item.id),
    ['project-b'],
    '撤为草稿后不再公开',
  )

  await writeFile(path.join(root, 'public/images/portfolio-cover.png'), 'image fixture')
  const ws = resolveWorkspace(adminRoot)
  const unused = await findUnusedImages(ws)
  assert.ok(
    !unused.images.some((image) => image.name === 'portfolio-cover.png'),
    '作品封面不会被垃圾清理误删',
  )
  const deleted = await call('PUT', { items: [], revision: latest.revision })
  assert.equal(deleted.status, 200)
  assert.deepEqual((await call('GET')).data.items, [])
  const backups = await readdir(ws.trashDir)
  assert.equal(backups.length, 1)
  assert.deepEqual(
    JSON.parse(await readFile(path.join(ws.trashDir, backups[0]!), 'utf8')),
    latest.items,
    '删除前保存完整备份',
  )

  for (const invalid of ['{bad json', '', ' ', 'null']) {
    await writeFile(file, invalid)
    assert.equal((await call('GET')).status, 400)
    assert.equal((await call('PUT', { items: [], revision: deleted.data.revision })).status, 400)
    assert.equal(await readFile(file, 'utf8'), invalid, '损坏文件不能被空数组覆盖')
  }

  const response = await fetch(`${base}/api/page`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'projects', title: '冲突页面', body: '' }),
  })
  assert.equal(response.status, 400, '固定页不能占用作品地址')
  console.log(
    '作品检查通过：接口增删改、双语、发布与排序、草稿隔离、输入校验、并发冲突、删除备份、封面引用与路由保护。',
  )
} finally {
  await server.close()
  if (previousRoot === undefined) delete process.env.ADMIN_BLOG_ROOT
  else process.env.ADMIN_BLOG_ROOT = previousRoot
  await rm(root, { recursive: true, force: true })
}
