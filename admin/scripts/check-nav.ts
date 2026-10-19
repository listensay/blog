import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { readNav, writeNav } from '../server/nav.ts'
import type { Workspace } from '../server/paths.ts'

const root = await mkdtemp(path.join(tmpdir(), 'blog-nav-check-'))
const ws: Workspace = {
  blogRoot: root,
  contentDir: path.join(root, 'content'),
  postsDir: path.join(root, 'content/blog'),
  pagesDir: path.join(root, 'content/pages'),
  navFile: path.join(root, 'content/data/nav.json'),
  siteFile: path.join(root, 'content/data/site.json'),
  publicDir: path.join(root, 'public'),
  imagesDir: path.join(root, 'public/images'),
  trashDir: path.join(root, '.trash'),
}

try {
  const legacy = { label: '首页', to: '/', icon: 'home', color: '#3b82f6' }
  await writeNav(ws, [legacy])
  assert.deepEqual((await readNav(ws)).items, [legacy], '旧版单名称菜单仍可读写')

  const home = { ...legacy, label: '主页' }
  const custom = {
    label: '随笔',
    to: '/notes',
    icon: 'book',
    color: '#64748b',
  }
  await writeNav(ws, [home, { ...custom, label: ' 随笔 ', labelEn: ' Field Notes ' }])
  assert.deepEqual(
    (await readNav(ws)).items,
    [home, custom],
    '菜单保存名称并去除首尾空白，丢弃旧英文名称',
  )
  assert.deepEqual(
    JSON.parse(await readFile(ws.navFile, 'utf8')),
    [home, custom],
    '仅持久化当前菜单字段',
  )

  await writeNav(ws, [custom, home])
  assert.deepEqual((await readNav(ws)).items, [custom, home], '排序后名称仍对应原菜单项')

  const before = await readFile(ws.navFile, 'utf8')
  for (const [patch, message] of [
    [{ label: '' }, /名称不能为空/],
    [{ label: '中'.repeat(25) }, /名称太长/],
  ] as const) {
    await assert.rejects(writeNav(ws, [{ ...home, ...patch }]), message)
    assert.equal(await readFile(ws.navFile, 'utf8'), before, '校验失败不会覆盖已保存的菜单')
  }

  await writeNav(ws, [{ ...home, labelEn: '  ' }])
  assert.deepEqual(
    (await readNav(ws)).items,
    [{ ...legacy, label: '主页' }],
    '清空英文名称后不会残留旧英文名称',
  )
  console.log('菜单检查通过：旧数据兼容、单名称保存、排序、输入校验及失败时保留原文件。')
} finally {
  await rm(root, { recursive: true, force: true })
}
