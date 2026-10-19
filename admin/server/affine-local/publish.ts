import { readFile, lstat } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import YAML from 'yaml'
import { badRequest, conflict } from '../http.ts'
import { splitFrontmatter } from '../frontmatter.ts'
import { atomicWrite, stateDir } from '../affine/config.ts'
import { contentFiles, hash, safeContentPath, withSyncLock } from '../affine/sync.ts'
import { parseDocument, serializeDocument } from '../affine/document.ts'
import { readProjects, writeProjects } from '../projects.ts'
import type { Project } from '../../../app/types/project.ts'
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
// Keep retired bindings so old documents cannot be republished under Chinese URLs.
export function isEnglishBinding(binding: Binding | null | undefined) {
  return !!binding && (binding.file.startsWith('en/') || binding.metadata.locale === 'en')
}
export function chineseMetadata(metadata: Record<string, unknown>) {
  const { locale, titleEn, descriptionEn, ...chinese } = metadata
  return chinese
}
export const bindingKey = (workspaceId: string, docId: string) =>
  JSON.stringify([workspaceId, docId])
export function publicationStatus(storage: WorkspaceStorage, workspaceId: string, docId: string, journalDate?: unknown) {
  if (!workspaceId || !docId) throw badRequest('文档标识无效')
  const savedRevision = storage.request({
    op: 'clock',
    space: `local:workspace:${workspaceId}`,
    id: docId,
  }) as number | null
  const binding = storage.get<Binding>('blog-bindings', bindingKey(workspaceId, docId))
  const published =
    savedRevision !== null &&
    !isEnglishBinding(binding) &&
    binding?.documentRevision === savedRevision &&
    binding.metadata.draft !== true &&
    (binding.metadata.kind !== 'journal' || journalDate === undefined || journalDate === binding.metadata.date)
  return { savedRevision, published, draft: binding?.metadata.draft === true }
}
const revision = (file: string, raw: string) => {
  if (!file.endsWith('pages/links.md')) return hash(raw)
  const { data, body } = splitFrontmatter(raw)
  delete data.friends
  return hash(JSON.stringify(data) + body)
}
export function metadataFor(file: string, data: Record<string, unknown>) {
  if (file.startsWith('projects/')) {
    return {
      kind: 'project',
      slug: String(data.id ?? file.slice('projects/'.length)),
      title: String(data.title ?? ''),
      description: String(data.description ?? ''),
      cover: String(data.cover ?? ''),
      tags: Array.isArray(data.tags) ? data.tags : [],
      demoUrl: String(data.demoUrl ?? ''),
      repoUrl: String(data.repoUrl ?? ''),
      draft: data.draft === true,
      category: '作品',
      directory: '',
      date: new Date().toISOString().slice(0, 10),
      comments: false,
    }
  }
  const post = /^blog\//.test(file)
  const journal = /^journals\//.test(file)
  const relative = file.replace(/^(?:blog|pages|journals)\//, '')
  return {
    kind: journal ? 'journal' : post ? 'post' : 'page',
    slug: post ? data.slug : relative.replace(/\.md$/, ''),
    directory: post && path.posix.dirname(relative) !== '.' ? path.posix.dirname(relative) : '',
    date: journal ? relative.replace(/\.md$/, '') : String(data.date ?? new Date().toISOString().slice(0, 10)),
    description: data.description ?? '',
    category: data.category ?? '随笔',
    tags: data.tags ?? [],
    cover: data.cover ?? '',
    comments: data.comments === true,
    draft: data.draft === true,
    demoUrl: data.demoUrl ?? '',
    repoUrl: data.repoUrl ?? '',
  }
}
export async function bindFile(
  ws: Workspace,
  storage: WorkspaceStorage,
  workspaceId: string,
  docId: string,
  file: string,
) {
  if (file.startsWith('projects/')) {
    const projectId = file.slice('projects/'.length)
    const { items } = await readProjects(ws)
    const item = items.find((p) => p.id === projectId)
    if (!item) throw badRequest(`未找到作品：${file}`)
    const metadata = metadataFor(file, item as unknown as Record<string, unknown>)
    const binding: Binding = {
      workspaceId,
      docId,
      file,
      hash: hash(JSON.stringify(item)),
      path: '/projects',
      metadata,
      documentRevision: publicationStatus(storage, workspaceId, docId).savedRevision,
    }
    storage.set('blog-bindings', bindingKey(workspaceId, docId), binding)
    return binding
  }
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

async function saveAssets(ws: Workspace, assets: unknown[]): Promise<Map<string, string>> {
  const replacements = new Map<string, string>()
  for (const asset of assets as Record<string, unknown>[]) {
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
    replacements.set(asset.name, `/${file}`)
  }
  return replacements
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
    if (isEnglishBinding(previous)) throw badRequest('英文内容已移除，无法再次发布')
    if (metadata && 'locale' in metadata && metadata.locale !== 'zh-CN')
      throw badRequest('博客仅支持中文发布')
    const settings = chineseMetadata(metadata as Record<string, unknown>)
    if (settings.kind === 'journal') {
      if (input.journalDate !== settings.date)
        throw badRequest('日记日期必须与 AFFiNE 日记一致，请重新打开发布设置')
      if (previous?.metadata.kind === 'journal' && previous.metadata.date !== settings.date)
        throw conflict('已发布日记的日期不可更改，请恢复原日期或新建当天日记')
    }

    if (settings.kind === 'project') {
      if (previous && previous.metadata.kind !== 'project') {
        throw conflict('已发布内容的类型暂不可更改；请新建文档使用新地址')
      }
      const slug = String(settings.slug ?? previous?.metadata.slug ?? '').trim()
      if (!slug) throw badRequest('作品标识不能为空')
      if (!/^[a-zA-Z0-9_-]+$/.test(slug))
        throw badRequest('作品标识只能包含英文、数字、下划线和连字符')
      const projectTitle = title.trim() || String(settings.title ?? '').trim()
      if (!projectTitle) throw badRequest('作品名称不能为空')
      let description =
        typeof settings.description === 'string' && settings.description.trim()
          ? settings.description.trim()
          : markdown.replace(/^#\s+[^\n]+\n*/, '').trim()
      let cover = typeof settings.cover === 'string' ? settings.cover.trim() : ''
      const demoUrl = typeof settings.demoUrl === 'string' ? settings.demoUrl.trim() : ''
      const repoUrl = typeof settings.repoUrl === 'string' ? settings.repoUrl.trim() : ''
      const tags = Array.isArray(settings.tags)
        ? [...new Set(settings.tags.map((t) => String(t).trim()).filter(Boolean))]
        : []
      const draft = settings.draft === true

      const assetReplacements = await saveAssets(ws, assets)
      for (const [name, targetUrl] of assetReplacements) {
        description = description.replaceAll(name, targetUrl)
        cover = cover.replaceAll(name, targetUrl)
      }

      for (const [keyName, val] of [
        ['cover', cover],
        ['demoUrl', demoUrl],
        ['repoUrl', repoUrl],
      ] as const) {
        if (!val) continue
        if (/[\s\\]|[\p{Cc}]/u.test(val))
          throw badRequest(
            `${keyName === 'cover' ? '封面' : keyName === 'demoUrl' ? '演示链接' : '源码链接'}不是有效的网址`,
          )
        if (val.startsWith('/') && !val.startsWith('//')) continue
        try {
          const parsed = new URL(val)
          if (['https:', 'http:'].includes(parsed.protocol) && parsed.hostname) continue
        } catch {}
        throw badRequest(
          `${keyName === 'cover' ? '封面' : keyName === 'demoUrl' ? '演示链接' : '源码链接'}请填写 http(s) 链接或以 / 开头的站内地址`,
        )
      }

      const { items: currentProjects, revision: currentRevision } = await readProjects(ws)
      const targetId = previous ? String(previous.metadata.slug) : slug
      const currentItem = currentProjects.find((p) => p.id === targetId)
      if (previous) {
        if (currentItem) {
          const currentHash = hash(JSON.stringify(currentItem))
          const legacyHash = hash(JSON.stringify({
            id: currentItem.id, title: currentItem.title,
            titleEn: previous.metadata.titleEn ?? '',
            description: currentItem.description,
            descriptionEn: previous.metadata.descriptionEn ?? '',
            cover: currentItem.cover, tags: currentItem.tags,
            demoUrl: currentItem.demoUrl, repoUrl: currentItem.repoUrl, draft: currentItem.draft,
          }))
          if (currentHash !== previous.hash && legacyHash !== previous.hash)
            throw conflict('本地作品数据已被修改，请先合并修改，避免覆盖')
        }
      } else {
        if (currentProjects.some((p) => p.id === slug))
          throw conflict(`作品标识已被其他作品使用：${slug}`)
      }

      const projectItem: Project = {
        id: slug,
        title: projectTitle,
        description,
        cover,
        tags,
        demoUrl,
        repoUrl,
        draft,
      }
      const exists = currentProjects.some((p) => p.id === targetId)
      const nextProjects = exists
        ? currentProjects.map((p) => (p.id === targetId ? projectItem : p))
        : [...currentProjects, projectItem]

      await writeProjects(ws, { items: nextProjects, revision: currentRevision })
      const file = `projects/${slug}`
      const afterHash = hash(JSON.stringify(projectItem))
      storage.set('blog-bindings', key, {
        workspaceId,
        docId,
        file,
        hash: afterHash,
        path: '/projects',
        metadata: {
          kind: 'project',
          slug,
          title: projectTitle,
          description,
          cover,
          tags,
          demoUrl,
          repoUrl,
          draft,
        },
        documentRevision: documentRevision as number,
      })
      return { path: '/projects', file }
    }

    const moved =
      previous &&
      ['kind', 'slug', 'directory'].some(
        (k) => (settings[k] ?? '') !== (previous.metadata[k] ?? ''),
      )
    if (moved) throw conflict('已发布内容的类型和地址暂不可更改；请新建文档使用新地址')
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
      const route = /^blog\//.test(file)
        ? `/${path.posix.dirname(file)}/${data.slug ?? path.posix.basename(file, '.md')}`
        : `/${file.replace('pages/', '').replace(/\.md$/, '')}`
      if (route === doc.path) throw conflict(`地址已被其他内容使用：${doc.path}`)
    }
    const assetReplacements = await saveAssets(ws, assets)
    for (const [name, targetUrl] of assetReplacements) {
      doc.body = doc.body.replaceAll(name, targetUrl)
    }
    if (before !== null) doc.data = { ...splitFrontmatter(before).data, ...doc.data }
    const publishedSettings = { ...settings }
    if ((settings.kind === 'post' || settings.kind === 'journal') && typeof settings.cover === 'string') {
      const cover = assetReplacements.get(settings.cover.trim()) ?? settings.cover.trim()
      if (cover) doc.data.cover = cover
      else delete doc.data.cover
      publishedSettings.cover = cover
    }
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
        metadata: publishedSettings,
        documentRevision: documentRevision as number,
      } satisfies Binding)
    } catch (error) {
      if (before !== null) await atomicWrite(target, before)
      throw error
    }
    return { path: doc.path, file: doc.file }
  })
}
