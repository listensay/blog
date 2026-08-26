import { readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type {
  FriendLink,
  PageDetail,
  PageInput,
  PageListResponse,
  PageSummary,
} from '../src/types.ts'
import {
  PAGE_KEY_ORDER,
  buildPageFrontmatter,
  countBodyImages,
  normalizePageFrontmatter,
  serializeFile,
  splitFrontmatter,
  withLeadingBlankLine,
} from './frontmatter.ts'
import { badRequest, conflict, notFound } from './http.ts'
import { PAGES_PREFIX, type Workspace, ensureDir, resolvePageFile, toPosix } from './paths.ts'
import { moveToTrash } from './trash.ts'

const PAGE_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/

const RESERVED_FIRST_SEGMENTS = new Set(['blog', 'categories', 'tags', 'admin', 'index'])

const CUSTOM_ROUTE_FILES = new Set([`${PAGES_PREFIX}/links.md`])

function pathOf(name: string): string {
  return `/${name}`
}

async function walkMarkdown(dir: string, base = ''): Promise<string[]> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }

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

async function toSummary(ws: Workspace, relative: string): Promise<PageSummary> {
  const absolute = path.join(ws.pagesDir, relative)
  const [raw, stats] = await Promise.all([readFile(absolute, 'utf8'), stat(absolute)])

  const { data, body } = splitFrontmatter(raw)
  const fm = normalizePageFrontmatter(data)
  const posix = toPosix(relative)
  const name = posix.replace(/\.md$/i, '')
  const file = `${PAGES_PREFIX}/${posix}`

  return {
    ...fm,
    file,
    name,
    path: pathOf(name),
    customRoute: CUSTOM_ROUTE_FILES.has(file),
    mtime: stats.mtimeMs,
    bytes: stats.size,
    images: countBodyImages(body),
  }
}

export async function listPages(ws: Workspace): Promise<PageListResponse> {
  const files = await walkMarkdown(ws.pagesDir)
  const pages = await Promise.all(files.map((file) => toSummary(ws, file)))

  pages.sort((a, b) => a.path.localeCompare(b.path))

  return { pages, reserved: [...RESERVED_FIRST_SEGMENTS] }
}

export async function readPage(ws: Workspace, file: string): Promise<PageDetail> {
  const absolute = resolvePageFile(ws, file)

  let raw: string
  try {
    raw = await readFile(absolute, 'utf8')
  } catch {
    throw notFound(`页面不存在：${file}`)
  }

  const { data, body } = splitFrontmatter(raw)
  const summary = await toSummary(ws, path.relative(ws.pagesDir, absolute))

  return { ...summary, body, raw: data }
}

const USABLE_LINK = /^(?:https?:\/\/|\/)/

function validateFriends(input: FriendLink[] | undefined): FriendLink[] {
  const friends: FriendLink[] = []

  for (const [index, item] of (input ?? []).entries()) {
    const at = `第 ${index + 1} 条友链`
    const name = item?.name?.trim() ?? ''
    const url = item?.url?.trim() ?? ''
    const avatar = item?.avatar?.trim() ?? ''

    const description = item?.description?.trim() ?? ''
    if (!name && !url && !avatar && !description) continue

    if (!name) throw badRequest(`${at}的名称不能为空`)
    if (!url) throw badRequest(`${at}（${name}）的网址不能为空`)
    if (!USABLE_LINK.test(url)) {
      throw badRequest(`${at}（${name}）的网址要以 https:// 或 / 开头：${url}`)
    }
    if (avatar && !USABLE_LINK.test(avatar)) {
      throw badRequest(
        `${at}（${name}）的头像需填站点地址（/images/x.png）或 http(s) 链接：${avatar}`,
      )
    }

    friends.push({ name, url, description, ...(avatar ? { avatar } : {}) })
  }

  return friends
}

function validate(input: PageInput): PageInput {
  const name = (input.name?.trim() ?? '').replace(/^\/+|\/+$/g, '')
  const title = input.title?.trim() ?? ''

  if (!title) throw badRequest('标题不能为空')
  if (!name) throw badRequest('文件名不能为空')
  if (!PAGE_NAME_RE.test(name)) {
    throw badRequest(`文件名只能用小写字母、数字和连字符：${name}`)
  }

  const first = name.split('/')[0] ?? ''
  if (RESERVED_FIRST_SEGMENTS.has(first)) {
    throw badRequest(`/${first} 是站点内置页面，pages/${name}.md 不会生效，请更换文件名`)
  }

  return {
    ...input,
    name,
    title,
    description: input.description?.trim() ?? '',
    friends: validateFriends(input.friends),
    body: input.body ?? '',
  }
}

const fileIdOf = (name: string) => `${PAGES_PREFIX}/${name}.md`

async function exists(absolute: string): Promise<boolean> {
  try {
    await stat(absolute)
    return true
  } catch {
    return false
  }
}

export async function createPage(ws: Workspace, raw: PageInput): Promise<PageDetail> {
  const input = validate(raw)
  const file = fileIdOf(input.name)
  const absolute = resolvePageFile(ws, file)

  if (await exists(absolute)) throw conflict(`文件已存在：${file}`)

  ensureDir(path.dirname(absolute))
  await writeFile(
    absolute,
    serializeFile(
      buildPageFrontmatter(input, input.raw),
      withLeadingBlankLine(input.body),
      PAGE_KEY_ORDER,
    ),
    'utf8',
  )

  return readPage(ws, file)
}

export async function updatePage(ws: Workspace, file: string, raw: PageInput): Promise<PageDetail> {
  const input = validate(raw)
  const from = resolvePageFile(ws, file)
  if (!(await exists(from))) throw notFound(`页面不存在：${file}`)

  const targetFile = fileIdOf(input.name)
  const to = resolvePageFile(ws, targetFile)
  const moving = path.resolve(from) !== path.resolve(to)

  if (moving && (await exists(to))) throw conflict(`目标文件已存在：${targetFile}`)

  ensureDir(path.dirname(to))
  await writeFile(
    to,
    serializeFile(buildPageFrontmatter(input, input.raw), input.body, PAGE_KEY_ORDER),
    'utf8',
  )
  if (moving) await unlink(from)

  return readPage(ws, targetFile)
}

export async function trashPage(ws: Workspace, file: string): Promise<{ trashed: string }> {
  const absolute = resolvePageFile(ws, file)
  if (!(await exists(absolute))) throw notFound(`页面不存在：${file}`)

  const flat = `pages__${file.slice(PAGES_PREFIX.length + 1).replace(/\//g, '__')}`
  return { trashed: await moveToTrash(ws, absolute, flat) }
}
