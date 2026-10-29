import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'

import type { FriendLink, PageDetail, PageListResponse, PageSummary } from '../src/types.ts'
import {
  PAGE_KEY_ORDER,
  countBodyImages,
  normalizePageFrontmatter,
  serializeFile,
  splitFrontmatter,
} from './frontmatter.ts'
import { badRequest, notFound } from './http.ts'
import { PAGES_PREFIX, type Workspace, resolvePageFile, toPosix } from './paths.ts'
import { atomicWrite } from './affine/config.ts'
import { safeContentPath } from './affine/sync.ts'

const RESERVED_FIRST_SEGMENTS = new Set([
  'blog',
  'categories',
  'tags',
  'admin',
  'index',
  'projects',
])

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

export async function writeFriends(ws: Workspace, input: unknown): Promise<PageDetail> {
  if (!Array.isArray(input)) throw badRequest('friends 须为数组')
  const page = await readPage(ws, 'pages/links.md')
  const friends = validateFriends(input)
  await atomicWrite(
    await safeContentPath(ws, page.file),
    serializeFile({ ...page.raw, friends }, page.body, PAGE_KEY_ORDER),
  )
  return readPage(ws, page.file)
}
