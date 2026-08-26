import { readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { PostDetail, PostInput, PostListResponse, PostSummary } from '../src/types.ts'
import {
  POST_KEY_ORDER,
  buildFrontmatter,
  countBodyImages,
  normalizeFrontmatter,
  serializeFile,
  splitFrontmatter,
  withLeadingBlankLine,
} from './frontmatter.ts'
import { badRequest, conflict, notFound } from './http.ts'
import { POSTS_PREFIX, type Workspace, ensureDir, resolvePostFile, toPosix } from './paths.ts'
import { moveToTrash } from './trash.ts'

const DIR_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const BAD_FILENAME_CHARS = /[\\/:*?"<>|]|\p{Cc}/u

async function walkMarkdown(dir: string, base = ''): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const rel = base ? `${base}/${entry.name}` : entry.name

    if (entry.isDirectory()) {
      files.push(...(await walkMarkdown(path.join(dir, entry.name), rel)))
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(rel)
    }
  }

  return files.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
}

function computeRealPath(dir: string, slug: string): string {
  if (!slug) return ''
  const segments = [POSTS_PREFIX, ...(dir ? dir.split('/') : []), slug]
  return `/${segments.join('/')}`
}

async function toSummary(ws: Workspace, relative: string): Promise<PostSummary> {
  const absolute = path.join(ws.postsDir, relative)
  const [raw, stats] = await Promise.all([readFile(absolute, 'utf8'), stat(absolute)])

  const { data, body } = splitFrontmatter(raw)
  const fm = normalizeFrontmatter(data)

  const posix = toPosix(relative)
  const lastSlash = posix.lastIndexOf('/')
  const dir = lastSlash === -1 ? '' : posix.slice(0, lastSlash)
  const filename = lastSlash === -1 ? posix : posix.slice(lastSlash + 1)

  return {
    ...fm,
    file: `${POSTS_PREFIX}/${posix}`,
    dir,
    name: filename.replace(/\.md$/i, ''),
    realPath: computeRealPath(dir, fm.slug),
    mtime: stats.mtimeMs,
    bytes: stats.size,
    images: countBodyImages(body),
  }
}

export async function listPosts(ws: Workspace): Promise<PostListResponse> {
  const files = await walkMarkdown(ws.postsDir)
  const posts = await Promise.all(files.map((file) => toSummary(ws, file)))

  posts.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.mtime - a.mtime)

  const categories = new Set<string>()
  const tags = new Set<string>()
  const dirs = new Set<string>()
  for (const post of posts) {
    if (post.category) categories.add(post.category)
    for (const tag of post.tags) tags.add(tag)
    if (post.dir) dirs.add(post.dir)
  }

  for (const entry of await readdir(ws.postsDir, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) dirs.add(entry.name)
  }

  const byZh = (a: string, b: string) => a.localeCompare(b, 'zh-Hans-CN')
  return {
    posts,
    categories: [...categories].sort(byZh),
    tags: [...tags].sort(byZh),
    dirs: [...dirs].sort(byZh),
  }
}

export async function readPost(ws: Workspace, file: string): Promise<PostDetail> {
  const absolute = resolvePostFile(ws, file)

  let raw: string
  try {
    raw = await readFile(absolute, 'utf8')
  } catch {
    throw notFound(`文章不存在：${file}`)
  }

  const { data, body } = splitFrontmatter(raw)
  const summary = await toSummary(ws, path.relative(ws.postsDir, absolute))

  return { ...summary, body, raw: data }
}

const DATE_TIME_FORMAT = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/

function isRealDateTime(value: string): boolean {
  const matched = DATE_TIME_FORMAT.exec(value)
  if (!matched) return false

  const [year, month, day, hour, minute] = matched.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ]
  if (month > 12 || day > 31 || hour > 23 || minute > 59) return false

  const parsed = new Date(year, month - 1, day, hour, minute)
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() + 1 === month &&
    parsed.getDate() === day &&
    parsed.getHours() === hour &&
    parsed.getMinutes() === minute
  )
}

function validate(input: PostInput): PostInput {
  const name = input.name?.trim() ?? ''
  const dir = (input.dir?.trim() ?? '').replace(/^\/+|\/+$/g, '')
  const title = input.title?.trim() ?? ''
  const slug = input.slug?.trim() ?? ''
  const rawDate = input.date?.trim() ?? ''
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? `${rawDate} 00:00` : rawDate

  if (!title) throw badRequest('标题不能为空')
  if (!name) throw badRequest('文件名不能为空')
  if (BAD_FILENAME_CHARS.test(name)) throw badRequest(`文件名不能包含 \\ / : * ? " < > | ：${name}`)
  if (name.startsWith('.') || /[. ]$/.test(name)) throw badRequest(`文件名不能以点或空格开头结尾：${name}`)
  if (dir && !DIR_RE.test(dir)) throw badRequest(`子目录只能用字母数字和 - _ .：${dir}`)
  if (!slug) throw badRequest('slug 不能为空（文章 URL 靠它生成）')
  if (!SLUG_RE.test(slug)) throw badRequest(`slug 只能用小写字母、数字和连字符：${slug}`)
  if (!DATE_TIME_FORMAT.test(date)) {
    throw badRequest(`日期时间要写成 YYYY-MM-DD HH:mm：${input.date}`)
  }
  if (!isRealDateTime(date)) throw badRequest(`这个时刻不存在：${date}`)

  return {
    ...input,
    dir,
    name,
    title,
    slug,
    date,
    description: input.description?.trim() ?? '',
    category: input.category?.trim() ?? '',
    tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
    path: input.path?.trim() ?? '',
    cover: input.cover?.trim() ?? '',
    draft: input.draft === true,
    body: input.body ?? '',
  }
}

async function assertSlugFree(
  ws: Workspace,
  dir: string,
  slug: string,
  ignoreFile?: string,
): Promise<void> {
  const realPath = computeRealPath(dir, slug)
  const { posts } = await listPosts(ws)
  const clash = posts.find((p) => p.realPath === realPath && p.file !== ignoreFile)
  if (clash) {
    throw conflict(`slug「${slug}」和 ${clash.file} 撞了，两篇文章的 URL 都是 ${realPath}`)
  }
}

const fileIdOf = (dir: string, name: string) =>
  `${POSTS_PREFIX}/${dir ? `${dir}/` : ''}${name}.md`

async function exists(absolute: string): Promise<boolean> {
  try {
    await stat(absolute)
    return true
  } catch {
    return false
  }
}

export async function createPost(ws: Workspace, raw: PostInput): Promise<PostDetail> {
  const input = validate(raw)
  const file = fileIdOf(input.dir, input.name)
  const absolute = resolvePostFile(ws, file)

  if (await exists(absolute)) throw conflict(`文件已存在：${file}`)
  await assertSlugFree(ws, input.dir, input.slug)

  ensureDir(path.dirname(absolute))
  await writeFile(
    absolute,
    serializeFile(
      buildFrontmatter(input, input.raw),
      withLeadingBlankLine(input.body),
      POST_KEY_ORDER,
    ),
    'utf8',
  )

  return readPost(ws, file)
}

export async function updatePost(ws: Workspace, file: string, raw: PostInput): Promise<PostDetail> {
  const input = validate(raw)
  const from = resolvePostFile(ws, file)
  if (!(await exists(from))) throw notFound(`文章不存在：${file}`)

  const targetFile = fileIdOf(input.dir, input.name)
  const to = resolvePostFile(ws, targetFile)
  const moving = path.resolve(from) !== path.resolve(to)

  if (moving && (await exists(to))) throw conflict(`目标文件已存在：${targetFile}`)
  await assertSlugFree(ws, input.dir, input.slug, file)

  ensureDir(path.dirname(to))
  await writeFile(
    to,
    serializeFile(buildFrontmatter(input, input.raw), input.body, POST_KEY_ORDER),
    'utf8',
  )
  if (moving) await unlink(from)

  return readPost(ws, targetFile)
}

export async function trashPost(ws: Workspace, file: string): Promise<{ trashed: string }> {
  const absolute = resolvePostFile(ws, file)
  if (!(await exists(absolute))) throw notFound(`文章不存在：${file}`)

  const flat = file.slice(POSTS_PREFIX.length + 1).replace(/\//g, '__')
  return { trashed: await moveToTrash(ws, absolute, flat) }
}
