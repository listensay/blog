import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { WorkspaceStorage } from '../server/affine-local/storage.ts'
import { LocalAffineService } from '../server/affine-local/service.ts'
import { resolveWorkspace } from '../server/paths.ts'
import { markdownForImport } from '../server/affine-local/import.ts'

const htmlImage = '<img\n src="/affine-assets/a.png"\n alt="图 &amp; 示例"\n/>'
assert.equal(markdownForImport(htmlImage), '![图 & 示例](</affine-assets/a.png>)')
assert.equal(
  markdownForImport(`\`\`\`html\n${htmlImage}\n\`\`\``),
  `\`\`\`html\n${htmlImage}\n\`\`\``,
)
assert.equal(
  markdownForImport('<img src="../../public/images/a b.png" alt="[图]">'),
  '![\\[图\\]](</images/a%20b.png>)',
)

const root = await mkdtemp(path.join(tmpdir(), 'blog-affine-source-check-'))
let db: WorkspaceStorage | undefined
let service: LocalAffineService | undefined
try {
  const file = path.join(root, 'state/notes.sqlite')
  db = new WorkspaceStorage(file)
  const request = (op: string, args = {}) =>
    db!.request({ op, space: 'local:workspace:demo', id: 'doc', ...args })
  const first = request('push', { bin: [1, 2] }) as number
  const second = request('push', { bin: [3] }) as number
  assert.ok(second > first)
  assert.equal(
    request('merge', { times: [first] }),
    0,
    'must retain updates without durable snapshot',
  )
  request('setSnapshot', { bin: [1, 2], at: first })
  assert.equal(request('merge', { times: [first, second] }), 1)
  assert.equal((request('updates') as unknown[]).length, 1)
  request('blobSet', { data: [137, 80, 78, 71], mime: 'image/png', at: first })
  request('kvSet', { value: JSON.stringify({ title: '中文文档' }) })
  assert.throws(() => request('push', { bin: [256] }))
  db.close()
  db = new WorkspaceStorage(file)
  assert.deepEqual((request('snapshot') as { bin: number[] }).bin, [1, 2])
  assert.equal(request('clock'), second)
  assert.equal((request('blobGet') as { mime: string }).mime, 'image/png')
  assert.match(request('kvGet') as string, /中文文档/)
  request('blobDelete', { permanently: false })
  assert.equal(request('blobGet'), null)
  request('blobSet', { data: [1], mime: 'image/png' })
  assert.ok(request('blobGet'))
  console.log('✓ SQLite 重启持久化、单调时钟、快照合并、附件恢复与非法输入')

  await mkdir(path.join(root, 'content/blog/notes'), { recursive: true })
  await mkdir(path.join(root, 'content/pages'), { recursive: true })
  await mkdir(path.join(root, 'public/images'), { recursive: true })
  await mkdir(path.join(root, 'admin'), { recursive: true })
  const sourceFile = path.join(root, 'content/blog/notes/原文.md')
  await writeFile(
    sourceFile,
    '---\ntitle: 原文\nslug: original\ndate: 2026-10-17\ncategory: AI\n---\n原始正文\n',
  )
  service = new LocalAffineService(resolveWorkspace(path.join(root, 'admin')))
  const invoke = (command: string, args: Record<string, unknown> = {}) =>
    service!.invoke(command, args)
  const saveDocument = (docId: string) =>
    service!.storage.request({
      op: 'push',
      space: 'local:workspace:local',
      id: docId,
      bin: [1],
    }) as number
  const status = (docId = 'original', workspaceId = 'local') =>
    invoke('blog_publication_status', { workspaceId, docId }) as Promise<{
      savedRevision: number | null
      published: boolean
      draft: boolean
    }>
  const seed = (await invoke('blog_seed', { workspaceId: 'local' })) as { markdown: string }[]
  assert.equal(seed.length, 1)
  assert.equal(seed[0]?.markdown.trim(), '原始正文', 'the title must not be duplicated in the body')
  const importedRevision = saveDocument('original')
  await invoke('blog_bind', { workspaceId: 'local', docId: 'original', file: 'blog/notes/原文.md' })
  assert.deepEqual(await status(), {
    savedRevision: importedRevision,
    published: true,
    draft: false,
  })
  assert.deepEqual(await invoke('blog_documents', { workspaceId: 'local' }), [
    { docId: 'original', kind: 'post', category: 'AI' },
  ])
  assert.deepEqual(await invoke('blog_documents', { workspaceId: 'another-workspace' }), [])
  await assert.rejects(invoke('blog_documents'), /工作区标识/)
  assert.equal(((await invoke('blog_seed', { workspaceId: 'local' })) as unknown[]).length, 0)
  const metadata = await invoke('blog_metadata', { workspaceId: 'local', docId: 'original' })
  const input = {
    workspaceId: 'local',
    docId: 'original',
    title: '原文',
    markdown: '# 原文\n\n已更新正文\n\n![图](assets/test.png)',
    metadata,
    assets: [
      {
        name: 'assets/test.png',
        mime: 'image/png',
        data: Buffer.from([137, 80, 78, 71]).toString('base64'),
      },
    ],
    documentRevision: saveDocument('original'),
  }
  assert.equal((await status()).published, false)
  assert.equal((await status('original', 'another-workspace')).savedRevision, null)
  await assert.rejects(invoke('blog_publication_status'), /文档标识/)
  const saved = (await invoke('blog_publish', input)) as { path: string }
  assert.equal(saved.path, '/blog/notes/original')
  const after = await readFile(sourceFile, 'utf8')
  assert.match(after, /已更新正文/)
  assert.match(after, /\/affine-assets\/[a-f0-9]+\.png/)
  assert.equal((await status()).published, true)
  service.stop()
  service = new LocalAffineService(resolveWorkspace(path.join(root, 'admin')))
  assert.equal((await status()).published, true, 'publication revision survives restart')
  const newRevision = saveDocument('original')
  assert.equal((await status()).published, false, 'new saves must not appear published')
  assert.equal(await readFile(sourceFile, 'utf8'), after, 'autosave must not publish Markdown')
  await assert.rejects(invoke('blog_publish', input), /文档已有新修改/)
  input.documentRevision = newRevision
  await invoke('blog_publish', { ...input, metadata: { ...(metadata as object), draft: true } })
  assert.deepEqual(await status(), { savedRevision: newRevision, published: false, draft: true })
  await invoke('blog_publish', input)
  assert.equal((await status()).published, true)
  await assert.rejects(
    invoke('blog_publish', { ...input, documentRevision: undefined }),
    /保存完成/,
  )
  console.log('✓ 保存与发布状态、重启持久化、新修改未发布、版本冲突保护与草稿提示')
  await invoke('blog_publish', {
    ...input,
    metadata: { ...(metadata as object), category: '  开发  ' },
  })
  assert.deepEqual(
    await invoke('blog_documents', { workspaceId: 'local' }),
    [{ docId: 'original', kind: 'post', category: '开发' }],
    'publishing a changed category updates the folder catalog',
  )
  await invoke('blog_publish', {
    ...input,
    metadata: { ...(metadata as object), category: ' ' },
  })
  assert.deepEqual(
    await invoke('blog_documents', { workspaceId: 'local' }),
    [{ docId: 'original', kind: 'post', category: '未分类' }],
    'empty categories belong in the uncategorized folder',
  )
  await invoke('blog_publish', input)
  console.log('✓ 博客分类目录、重新发布后分类更新与空分类兜底')
  await writeFile(sourceFile, after + '\n外部修改\n')
  await assert.rejects(invoke('blog_publish', input), /本地 Markdown/)
  assert.match(await readFile(sourceFile, 'utf8'), /外部修改/)
  await assert.rejects(
    invoke('blog_publish', {
      ...input,
      docId: 'another',
      documentRevision: saveDocument('another'),
    }),
    /地址已被其他内容|已被修改/,
  )
  await assert.rejects(
    invoke('blog_publish', {
      ...input,
      docId: 'unsafe',
      documentRevision: saveDocument('unsafe'),
      metadata: { ...(metadata as object), slug: '../../escape' },
    }),
    /slug/,
  )
  const newPage = (await invoke('blog_publish', {
    workspaceId: 'local',
    docId: 'new-page',
    documentRevision: saveDocument('new-page'),
    title: '状态',
    markdown: '# 状态\n\n页面正文',
    metadata: { kind: 'page', locale: 'zh-CN', slug: 'status', comments: false },
    assets: [],
  })) as { path: string }
  assert.equal(newPage.path, '/status')
  assert.equal((await status('new-page')).published, true)
  assert.deepEqual(await invoke('blog_documents', { workspaceId: 'local' }), [
    { docId: 'new-page', kind: 'page' },
    { docId: 'original', kind: 'post', category: 'AI' },
  ])
  console.log('✓ 内容分类区分博客和页面，隔离工作区，并在新内容发布后更新')
  await symlink(path.join(root, 'state'), path.join(root, 'content/blog/escape'))
  await assert.rejects(
    invoke('blog_publish', {
      ...input,
      docId: 'symlink',
      documentRevision: saveDocument('symlink'),
      metadata: { ...(metadata as object), slug: 'new', directory: 'escape' },
    }),
    /符号链接/,
  )
  console.log('✓ 自动导入去重、原地址保留、图片发布、外部修改冲突、重复路由与路径隔离')
} finally {
  service?.stop()
  db?.close()
  await rm(root, { recursive: true, force: true })
}
