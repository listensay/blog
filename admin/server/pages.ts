// 固定页（`content/pages/**.md`）的增删改查。页面没有 slug 字段，URL 就是文件名
// 所以文件名本身必须能进 URL，改名等于换网址 —— 这里的校验基本都是它带来的
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

/** 页面文件名：小写字母、数字、连字符，可以多层（`a/b` → `/a/b`）。它会原样变成网址 */
const PAGE_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/

// 这些名字建了也白建：站点有手写的 .vue，优先级高于兜底的 `[...page].vue`，md 永远不渲染也不报错
// `links` 不在这里 —— links.vue 恰恰是去读 pages/links.md 的，那个页面必须能编辑
const RESERVED_FIRST_SEGMENTS = new Set(['blog', 'categories', 'tags', 'admin', 'index'])

// 站点上有专属 .vue 渲染的页面。删掉或改名不会 404 而是渲染成空页面，确认框文案要区分
// 站点上再给某个页面写专属 .vue 时往这儿加一条
const CUSTOM_ROUTE_FILES = new Set([`${PAGES_PREFIX}/links.md`])

/** 页面在站点上的 URL。`about` → `/about` */
function pathOf(name: string): string {
  return `/${name}`
}

/** 遍历页面目录，收集所有 .md（跳过隐藏目录） */
async function walkMarkdown(dir: string, base = ''): Promise<string[]> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    // content/pages 还不存在：一个页面都没有，不算错误
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

  // 按 URL 排（也就是文件名序）
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

/** 头像和友链地址：只接受 http(s) 外链，或者 `/` 开头的站点绝对路径 */
const USABLE_LINK = /^(?:https?:\/\/|\/)/

function validateFriends(input: FriendLink[] | undefined): FriendLink[] {
  const friends: FriendLink[] = []

  for (const [index, item] of (input ?? []).entries()) {
    const at = `第 ${index + 1} 条友链`
    const name = item?.name?.trim() ?? ''
    const url = item?.url?.trim() ?? ''
    const avatar = item?.avatar?.trim() ?? ''

    const description = item?.description?.trim() ?? ''
    // 整条都空着才跳过（点了「加一条」又没写完）。只填了描述的会走到下面报错，不静默丢
    if (!name && !url && !avatar && !description) continue

    if (!name) throw badRequest(`${at}没写名字`)
    if (!url) throw badRequest(`${at}（${name}）没写网址`)
    // 必须带协议或以 / 开头：`example.com` 会被当成相对地址，点下去跳到 /links/example.com
    if (!USABLE_LINK.test(url)) {
      throw badRequest(`${at}（${name}）的网址要以 https:// 或 / 开头：${url}`)
    }
    // 头像同理。frontmatter 里只有 cover 会被 image-src 改写，avatar 不会 ——
    // 写相对路径的话后台预览得到、线上 404
    if (avatar && !USABLE_LINK.test(avatar)) {
      throw badRequest(
        `${at}（${name}）的头像要写站点地址（/images/x.png）或 http(s) 链接，` +
          `相对路径线上会 404：${avatar}`,
      )
    }

    friends.push({ name, url, description, ...(avatar ? { avatar } : {}) })
  }

  return friends
}

/** 校验前端提交的内容，顺手 trim */
function validate(input: PageInput): PageInput {
  const name = (input.name?.trim() ?? '').replace(/^\/+|\/+$/g, '')
  const title = input.title?.trim() ?? ''

  if (!title) throw badRequest('标题不能为空')
  if (!name) throw badRequest('文件名不能为空（页面的网址就是它）')
  if (!PAGE_NAME_RE.test(name)) {
    throw badRequest(`文件名只能用小写字母、数字和连字符（它就是网址）：${name}`)
  }

  const first = name.split('/')[0] ?? ''
  if (RESERVED_FIRST_SEGMENTS.has(first)) {
    throw badRequest(
      `/${first} 是站点自己的页面（app/pages/${first} 那边手写的），` +
        `这里建的 pages/${name}.md 永远不会被访问到，换个名字吧`,
    )
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
    // 新建才补那个空行；updatePage 里是原样写回
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
  // 新文件写成功了才删旧的，中途挂掉最多留一份多余文件，不会两头都丢
  if (moving) await unlink(from)

  return readPage(ws, targetFile)
}

/** 删除 = 挪进 admin/.trash/。返回它现在在哪 */
export async function trashPage(ws: Workspace, file: string): Promise<{ trashed: string }> {
  const absolute = resolvePageFile(ws, file)
  if (!(await exists(absolute))) throw notFound(`页面不存在：${file}`)

  // 加 pages__ 前缀，回收站里一眼分得出是页面还是文章
  const flat = `pages__${file.slice(PAGES_PREFIX.length + 1).replace(/\//g, '__')}`
  return { trashed: await moveToTrash(ws, absolute, flat) }
}
