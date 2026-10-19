import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { unzipSync, strFromU8 } from 'fflate'
import { LocalAffineService } from '../server/affine-local/service.ts'
import { bindingKey } from '../server/affine-local/publish.ts'
import { isContentFile, isJournalDate, parseDocument } from '../server/affine/document.ts'
import { exportForAffine } from '../server/affine/export.ts'
import { splitFrontmatter } from '../server/frontmatter.ts'
import { resolveWorkspace } from '../server/paths.ts'
import journalPrivacy from '../../transformers/journal-privacy.ts'

assert.ok(journalPrivacy.transform)
for (const collection of ['journals']) {
  const privateEntry = {
    id: `${collection}/journals/2026-10-19.md`, date: '2026-10-19', draft: true,
    title: 'PRIVATE_TITLE', description: 'PRIVATE_SUMMARY', cover: 'PRIVATE_IMAGE',
    tags: ['PRIVATE_TAG'], rawbody: 'PRIVATE_RAW', seo: { title: 'PRIVATE_SEO' },
    body: { type: 'minimark', value: [['p', {}, 'PRIVATE_BODY']] },
  }
  const publicData = await journalPrivacy.transform(privateEntry, {})
  assert.ok(!JSON.stringify(publicData).includes('PRIVATE_'), 'journal drafts must not enter the public query database')
  assert.equal(publicData.draft, true)
  const published = { ...privateEntry, draft: false }
  assert.deepEqual(await journalPrivacy.transform(published, {}), published)
}
console.log('✓ 日记草稿正文、标题、摘要、封面、标签和额外元数据不会进入公开查询数据')

assert.equal(isJournalDate('2024-02-29'), true)
for (const date of ['2026-02-29', '2026-13-01', '2026-04-31', '2026-1-1', '../2026-10-19']) {
  assert.equal(isJournalDate(date), false)
  assert.equal(isContentFile(`journals/${date}.md`), false)
}
assert.throws(() => parseDocument({ id: 'page', title: '日记' }, '```yaml\nblog: true\nkind: page\nslug: journals\n```'), /内置路由/)
const root = await mkdtemp(path.join(tmpdir(), 'blog-journals-check-'))
let service: LocalAffineService | undefined
try {
  await mkdir(path.join(root, 'content/blog'), { recursive: true })
  await mkdir(path.join(root, 'public/images'), { recursive: true })
  const ws = resolveWorkspace(path.join(root, 'admin'))
  service = new LocalAffineService(ws)
  const invoke = (command: string, args: Record<string, unknown> = {}) => service!.invoke(command, args)
  const save = (docId: string) => service!.storage.request({ op: 'push', space: 'local:workspace:local', id: docId, bin: [1] }) as number
  const date = '2026-10-19'
  const metadata = await invoke('blog_metadata', { workspaceId: 'local', docId: 'today', journalDate: date }) as Record<string, unknown>
  assert.equal(metadata.kind, 'journal')
  assert.equal(metadata.date, date)
  assert.equal(metadata.slug, date)
  const input = {
    workspaceId: 'local', docId: 'today', journalDate: date, title: date,
    documentRevision: save('today'), markdown: '# 2026-10-19\n\n日记正文\n\n![图片](assets/photo.png)',
    metadata: { ...metadata, cover: 'assets/photo.png', description: '今天的记录', tags: ['日常'] },
    assets: [{ name: 'assets/photo.png', mime: 'image/png', data: Buffer.from('journal image').toString('base64') }],
  }
  const file = path.join(root, `content/journals/${date}.md`)
  await assert.rejects(readFile(file), { code: 'ENOENT' }, 'autosaving a journal never publishes it')
  assert.deepEqual(await invoke('blog_publish', input), { path: `/journals/${date}`, file: `journals/${date}.md` })
  const source = await readFile(file, 'utf8')
  const { data, body } = splitFrontmatter(source)
  assert.equal(data.date, date)
  assert.equal(data.draft, false)
  assert.match(String(data.cover), /^\/affine-assets\/[a-f0-9]+\.png$/)
  assert.ok(body.includes(String(data.cover)))
  assert.equal(await readFile(path.join(root, 'public', String(data.cover)), 'utf8'), 'journal image')
  assert.ok(!body.startsWith(`# ${date}`), 'the native date title is not repeated')
  assert.deepEqual(await invoke('blog_documents', { workspaceId: 'local' }), [{ docId: 'today', kind: 'journal' }])
  for (const [journalDate, published] of [[date, true], ['2026-10-20', false], ['', false]] as const) {
    assert.equal((await invoke('blog_publication_status', { workspaceId: 'local', docId: 'today', journalDate }) as { published: boolean }).published, published)
  }
  const reopened = await invoke('blog_metadata', { workspaceId: 'local', docId: 'today', journalDate: date }) as Record<string, unknown>
  assert.equal(reopened.cover, data.cover)
  await assert.rejects(invoke('blog_publish', { ...input, docId: 'duplicate', documentRevision: save('duplicate') }), /已被修改|地址已被其他/)
  await assert.rejects(invoke('blog_publish', { ...input, journalDate: '2026-10-20' }), /日期必须与 AFFiNE/)
  await assert.rejects(invoke('blog_publish', { ...input, journalDate: '2026-10-20', metadata: { ...input.metadata, date: '2026-10-20' } }), /日期不可更改/)
  await assert.rejects(invoke('blog_publish', { ...input, docId: 'invalid', documentRevision: save('invalid'), journalDate: '2026-02-29', metadata: { ...input.metadata, date: '2026-02-29' } }), /有效的 YYYY-MM-DD/)

  await invoke('blog_publish', { ...input, metadata: { ...reopened, draft: true, cover: '' }, assets: [] })
  assert.equal(splitFrontmatter(await readFile(file, 'utf8')).data.draft, true)
  assert.equal(splitFrontmatter(await readFile(file, 'utf8')).data.cover, undefined)
  assert.equal((await invoke('blog_publication_status', { workspaceId: 'local', docId: 'today', journalDate: date }) as { published: boolean }).published, false)
  await invoke('blog_publish', { ...input, metadata: reopened, assets: [] })
  service.stop()
  service = new LocalAffineService(ws)
  assert.equal((await invoke('blog_metadata', { workspaceId: 'local', docId: 'today', journalDate: date }) as Record<string, unknown>).kind, 'journal')
  assert.ok(service.storage.get('blog-bindings', bindingKey('local', 'today')))
  console.log('✓ AFFiNE 日记识别、按日发布、图片/封面、草稿撤回、日期锁定、去重与重启持久化')

  await assert.rejects(invoke('blog_publish', { ...input, docId: 'english', documentRevision: save('english'), metadata: { ...input.metadata, locale: 'en' } }), /仅支持中文/)
  assert.equal(isContentFile(`en/journals/${date}.md`), false)
  await assert.rejects(readFile(path.join(root, `content/en/journals/${date}.md`)), { code: 'ENOENT' })
  const retired = { workspaceId: 'local', docId: 'english', file: `en/journals/${date}.md`, path: `/en/journals/${date}`, hash: 'old', documentRevision: save('english'), metadata: { ...input.metadata, locale: 'en' } }
  service.storage.set('blog-bindings', bindingKey('local', 'english'), retired)
  assert.deepEqual(await invoke('blog_retired_documents', { workspaceId: 'local' }), ['english'])
  assert.deepEqual(await invoke('blog_retired_documents', { workspaceId: 'another' }), [])
  assert.deepEqual(await invoke('blog_documents', { workspaceId: 'local' }), [{ docId: 'today', kind: 'journal' }])
  assert.equal(await invoke('blog_find', { file: retired.file }), null)
  assert.equal((await invoke('blog_publication_status', { workspaceId: 'local', docId: 'english' }) as { published: boolean }).published, false)
  await assert.rejects(invoke('blog_metadata', { workspaceId: 'local', docId: 'english' }), /英文内容已移除/)
  await assert.rejects(invoke('blog_publish', { ...input, docId: 'english', documentRevision: retired.documentRevision }), /英文内容已移除/)
  const chineseBinding = service.storage.get<Record<string, unknown>>('blog-bindings', bindingKey('local', 'today'))!
  service.storage.set('blog-bindings', bindingKey('local', 'today'), { ...chineseBinding, metadata: { ...reopened, locale: 'zh-CN' } })
  assert.ok(!('locale' in (await invoke('blog_metadata', { workspaceId: 'local', docId: 'today' }) as object)))
  await invoke('blog_publish', { ...input, metadata: reopened, assets: [] })
  await writeFile(file, source + '\n外部编辑\n')
  await assert.rejects(invoke('blog_publish', input), /本地 Markdown 已被修改/)

  // Upgrade an already imported workspace: only the new journal files are seeded.
  service.storage.set('blog', 'workspace', 'local')
  service.storage.set('blog', 'seeded', true)
  service.storage.set('blog', 'projects_seeded', true)
  await writeFile(path.join(root, 'content/journals/2026-10-18.md'), '---\ntitle: 昨天\ndate: 2026-10-18\ndraft: true\n---\n昨天的日记\n')
  const seed = await invoke('blog_seed', { workspaceId: 'local' }) as { file: string; journalDate: string; markdown: string }[]
  assert.equal(seed.length, 1)
  assert.equal(seed[0]?.journalDate, '2026-10-18')
  assert.equal(seed[0]?.markdown.trim(), '昨天的日记')
  await invoke('blog_bind', { workspaceId: 'local', docId: 'yesterday', file: seed[0]!.file })
  const imported = await invoke('blog_metadata', { workspaceId: 'local', docId: 'yesterday' }) as Record<string, unknown>
  assert.equal(imported.kind, 'journal')
  assert.equal(imported.draft, true)
  await invoke('blog_seed_done', { workspaceId: 'local' })
  assert.deepEqual(await invoke('blog_seed', { workspaceId: 'local' }), [])
  const archive = unzipSync(await exportForAffine(ws))
  const journalExport = Object.entries(archive).find(([name]) => name.startsWith('content/journals/'))
  assert.ok(journalExport)
  assert.match(strFromU8(journalExport[1]), /kind: journal/)
  console.log('✓ 英文发布禁用与旧绑定隔离、中文旧绑定兼容、外部修改保护、旧工作区增量导入、原生日记日期与备份导出')
} finally {
  service?.stop()
  await rm(root, { recursive: true, force: true })
}
