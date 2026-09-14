import { createHash, randomUUID } from 'node:crypto'
import { lstat, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { PostFrontmatter } from '../src/types.ts'
import { POST_KEY_ORDER, serializeFile, splitFrontmatter } from './frontmatter.ts'
import { badRequest, conflict } from './http.ts'
import { ensureDir, isInside, type Workspace } from './paths.ts'

export const revisionOf = (raw: string) => createHash('sha256').update(raw).digest('hex')

interface TranslationSource {
  dir: string
  slug: string
}

export function translationFile(source: TranslationSource): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source.slug))
    throw badRequest('请先为中文文章设置有效的 slug')
  if (source.dir.split('/').some((part) => part === '..' || part.includes('\\')))
    throw badRequest('文章目录不合法')
  return ['en/blog', source.dir, `${source.slug}.md`].filter(Boolean).join('/')
}

export async function safeTranslationPath(ws: Workspace, file: string): Promise<string> {
  const root = path.join(ws.contentDir, 'en', 'blog')
  const absolute = path.resolve(ws.contentDir, file)
  if (!file.startsWith('en/blog/') || !file.endsWith('.md') || !isInside(root, absolute))
    throw badRequest('英文文章路径不合法')
  for (let current = absolute; current !== ws.contentDir; current = path.dirname(current)) {
    try {
      if ((await lstat(current)).isSymbolicLink()) throw badRequest('英文文章路径不能使用符号链接')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
  }
  return absolute
}

export async function readTranslationFile(ws: Workspace, source: TranslationSource) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source.slug)) return null
  const desired = translationFile(source)
  const directory = path.posix.dirname(desired)
  // Match by URL slug so older translations with a different filename are editable too.
  const dirPath = path.dirname(await safeTranslationPath(ws, desired))
  let names: string[]
  try {
    names = await readdir(dirPath)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
  const matches = []
  for (const name of names.filter((name) => !name.startsWith('.') && name.endsWith('.md'))) {
    const file = `${directory}/${name}`
    const absolute = await safeTranslationPath(ws, file)
    const raw = await readFile(absolute, 'utf8')
    const parsed = splitFrontmatter(raw)
    if (parsed.data.slug === source.slug) matches.push({ file, absolute, raw, ...parsed })
    else if (file === desired) throw conflict(`英文目标文件已被其他文章占用：${file}`)
  }
  if (matches.length > 1) throw conflict('同一个 URL 存在多篇英文文章，请先消除重复 slug')
  return matches[0] ?? null
}

export async function writeTranslationFile(
  ws: Workspace,
  file: string,
  raw: string,
): Promise<void> {
  const absolute = await safeTranslationPath(ws, file)
  ensureDir(path.dirname(absolute))
  const temp = `${absolute}.${randomUUID()}.tmp`
  try {
    await writeFile(temp, raw, { encoding: 'utf8', flag: 'wx' })
    await rename(temp, absolute)
  } finally {
    await unlink(temp).catch((err) => {
      if (err.code !== 'ENOENT') throw err
    })
  }
}

// Serialize local writes, including source moves, so revision checks remain meaningful.
let writeQueue: Promise<unknown> = Promise.resolve()
export function withContentWrite<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(fn, fn)
  writeQueue = result.catch(() => {})
  return result
}

export async function prepareTranslationMove(
  ws: Workspace,
  before: TranslationSource,
  after: TranslationSource & PostFrontmatter,
) {
  const existing = await readTranslationFile(ws, before)
  if (!existing) return null
  const moving = before.slug !== after.slug || before.dir !== after.dir
  const target = moving ? translationFile(after) : existing.file
  if (moving && (await readTranslationFile(ws, after)))
    throw conflict('新的英文地址已有文章，请先处理英文版冲突')
  const data = {
    ...existing.data,
    slug: after.slug,
    path: `/en/blog/${[after.dir, after.slug].filter(Boolean).join('/')}`,
  }
  // Unpublishing the source must also unpublish its translation.
  if (after.draft) Object.assign(data, { draft: true })
  return async () => {
    await writeTranslationFile(ws, target, serializeFile(data, existing.body, POST_KEY_ORDER))
    if (moving && target !== existing.file) await unlink(existing.absolute)
  }
}
