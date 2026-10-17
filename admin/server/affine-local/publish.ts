import { readFile, lstat } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import YAML from 'yaml'
import { badRequest, conflict } from '../http.ts'
import { splitFrontmatter } from '../frontmatter.ts'
import { atomicWrite, stateDir } from '../affine/config.ts'
import { contentFiles, hash, safeContentPath, withSyncLock } from '../affine/sync.ts'
import { parseDocument, serializeDocument } from '../affine/document.ts'
import type { Workspace } from '../paths.ts'
import type { WorkspaceStorage } from './storage.ts'

export interface Binding {
  workspaceId: string
  docId: string
  file: string
  hash: string
  path: string
  metadata: Record<string, unknown>
  documentRevision?: number | null
}
export const bindingKey = (workspaceId: string, docId: string) =>
  JSON.stringify([workspaceId, docId])
export function publicationStatus(storage: WorkspaceStorage, workspaceId: string, docId: string) {
  if (!workspaceId || !docId) throw badRequest('文档标识无效')
  const savedRevision = storage.request({
    op: 'clock',
    space: `local:workspace:${workspaceId}`,
    id: docId,
  }) as number | null
  const binding = storage.get<Binding>('blog-bindings', bindingKey(workspaceId, docId))
  const published =
    savedRevision !== null &&
    binding?.documentRevision === savedRevision &&
    binding.metadata.draft !== true
  return { savedRevision, published, draft: binding?.metadata.draft === true }
}
const revision = (file: string, raw: string) => {
  if (!file.endsWith('pages/links.md')) return hash(raw)
  const { data, body } = splitFrontmatter(raw)
  delete data.friends
  return hash(JSON.stringify(data) + body)
}
export function metadataFor(file: string, data: Record<string, unknown>) {
  const post = /^(?:en\/)?blog\//.test(file)
  const relative = file.replace(/^(?:en\/)?(?:blog|pages)\//, '')
  return {
    kind: post ? 'post' : 'page',
    locale: file.startsWith('en/') ? 'en' : 'zh-CN',
    slug: post ? data.slug : relative.replace(/\.md$/, ''),
    directory: post && path.posix.dirname(relative) !== '.' ? path.posix.dirname(relative) : '',
    date: String(data.date ?? new Date().toISOString().slice(0, 10)),
    description: data.description ?? '',
    category: data.category ?? '随笔',
    tags: data.tags ?? [],
    cover: data.cover ?? '',
    comments: data.comments === true,
    draft: data.draft === true,
  }
}
export async function bindFile(
  ws: Workspace,
  storage: WorkspaceStorage,
  workspaceId: string,
  docId: string,
  file: string,
) {
  const raw = await readFile(await safeContentPath(ws, file), 'utf8')
  const data = splitFrontmatter(raw).data
  const metadata = metadataFor(file, data)
  const binding: Binding = {
    workspaceId,
    docId,
    file,
    hash: revision(file, raw),
    path: String(data.path ?? `/${file.replace('pages/', '').replace(/\.md$/, '')}`),
    metadata,
    documentRevision: publicationStatus(storage, workspaceId, docId).savedRevision,
  }
  storage.set('blog-bindings', bindingKey(workspaceId, docId), binding)
  return binding
}
export async function publish(
  ws: Workspace,
  storage: WorkspaceStorage,
  input: Record<string, unknown>,
) {
  const { workspaceId, docId, title, markdown, metadata, assets, documentRevision } = input
  if (
    typeof workspaceId !== 'string' ||
    typeof docId !== 'string' ||
    !workspaceId ||
    !docId ||
    typeof title !== 'string' ||
    typeof markdown !== 'string' ||
    !metadata ||
    typeof metadata !== 'object' ||
    Array.isArray(metadata) ||
    !Array.isArray(assets)
  )
    throw badRequest('发布内容无效')
  return withSyncLock(ws, async () => {
    if (!Number.isSafeInteger(documentRevision) || Number(documentRevision) < 0)
      throw badRequest('请等待文档保存完成后再发布')
    if (publicationStatus(storage, workspaceId, docId).savedRevision !== documentRevision)
      throw conflict('文档已有新修改，请等待保存后重新发布')
    const key = bindingKey(workspaceId, docId)
    const previous = storage.get<Binding>('blog-bindings', key)
    const settings = metadata as Record<string, unknown>
    const moved =
      previous &&
      ['kind', 'locale', 'slug', 'directory'].some(
        (k) => (settings[k] ?? '') !== (previous.metadata[k] ?? ''),
      )
    if (moved) throw conflict('已发布内容的类型、语言和地址暂不可更改；请新建文档使用新地址')
    const safeSettings = {
      ...settings,
      blog: true,
      ...(previous ? { file: previous.file, migrationRevision: previous.hash } : {}),
    }
    const doc = parseDocument(
      { id: docId, title },
      `\`\`\`yaml\n${YAML.stringify(safeSettings)}\`\`\`\n\n${markdown}`,
    )
    if (!doc) throw badRequest('发布设置无效')
    const target = await safeContentPath(ws, doc.file)
    const before = await readFile(target, 'utf8').catch((e) => {
      if (e.code === 'ENOENT') return null
      throw e
    })
    if (before !== null && (!previous || revision(doc.file, before) !== previous.hash))
      throw conflict('本地 Markdown 已被修改，请先合并修改，避免覆盖')
    for (const file of await contentFiles(ws)) {
      if (file === doc.file) continue
      const data = splitFrontmatter(await readFile(await safeContentPath(ws, file), 'utf8')).data
      const route = /^(?:en\/)?blog\//.test(file)
        ? `/${path.posix.dirname(file)}/${data.slug ?? path.posix.basename(file, '.md')}`
        : `/${file.replace('pages/', '').replace(/\.md$/, '')}`
      if (route === doc.path) throw conflict(`地址已被其他内容使用：${doc.path}`)
    }
    for (const asset of assets) {
      if (
        !asset ||
        typeof asset.name !== 'string' ||
        !/^assets\/[^/\\\p{Cc}]+$/u.test(asset.name) ||
        typeof asset.data !== 'string' ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(asset.data)
      )
        throw badRequest('附件数据无效')
      const bytes = Buffer.from(asset.data, 'base64')
      const extensions: Record<string, string> = {
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/webp': '.webp',
        'image/gif': '.gif',
        'image/svg+xml': '.svg',
        'image/avif': '.avif',
        'application/pdf': '.pdf',
        'audio/mpeg': '.mp3',
        'video/mp4': '.mp4',
      }
      const ext = extensions[asset.mime as string] ?? '.bin'
      const file = `affine-assets/${hash(bytes)}${ext}`
      const absolute = path.join(ws.publicDir, file)
      for (let current = absolute; ; current = path.dirname(current)) {
        if (
          (
            await lstat(current).catch((e) => {
              if (e.code === 'ENOENT') return null
              throw e
            })
          )?.isSymbolicLink()
        )
          throw badRequest('附件目录不能是符号链接')
        if (current === ws.publicDir) break
      }
      await atomicWrite(absolute, bytes)
      doc.body = doc.body.replaceAll(asset.name, `/${file}`)
    }
    if (before !== null) doc.data = { ...splitFrontmatter(before).data, ...doc.data }
    const after = serializeDocument(doc)
    if (before !== null && before !== after)
      await atomicWrite(
        path.join(stateDir(ws), 'backups', `${Date.now()}-${randomUUID()}`, doc.file),
        before,
      )
    if (
      (await readFile(target, 'utf8').catch((e) => {
        if (e.code === 'ENOENT') return null
        throw e
      })) !== before
    )
      throw conflict('文件刚刚被修改，请重试')
    await atomicWrite(target, after)
    try {
      storage.set('blog-bindings', key, {
        workspaceId,
        docId,
        file: doc.file,
        hash: revision(doc.file, after),
        path: doc.path,
        metadata: settings,
        documentRevision: documentRevision as number,
      } satisfies Binding)
    } catch (error) {
      if (before !== null) await atomicWrite(target, before)
      throw error
    }
    return { path: doc.path, file: doc.file }
  })
}
