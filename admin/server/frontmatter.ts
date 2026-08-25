// frontmatter 的读写，文章和固定页共用。正文逐字节保留，不认识的字段原样带回去
// 日期全程按 `YYYY-MM-DD` 字符串传，免得时区把日期挪走一天
import YAML from 'yaml'

import type { FriendLink, PageFrontmatter, PostFrontmatter } from '../src/types.ts'

/** 文章 frontmatter 里已知字段的书写顺序，和现有文章保持一致 */
export const POST_KEY_ORDER = [
  'title',
  'description',
  'date',
  'slug',
  'path',
  'category',
  'tags',
  'draft',
  'cover',
] as const

/** 固定页 frontmatter 的字段顺序（见 content.config.ts 的 pages 集合） */
export const PAGE_KEY_ORDER = ['title', 'description', 'friends'] as const

/** 正文里的图片：markdown 图片语法 + 裸 `<img>`。列表页显示「几张图」用 */
const MD_IMAGE_RE = /!\[[^\]]*\]\([^)]+\)/g
const HTML_IMAGE_RE = /<img\b/gi

export function countBodyImages(body: string): number {
  return (body.match(MD_IMAGE_RE)?.length ?? 0) + (body.match(HTML_IMAGE_RE)?.length ?? 0)
}

/** 给 `---` 和正文之间补一个空行。只在新建时用，已有文件一律原样写回 */
export function withLeadingBlankLine(body: string): string {
  if (!body.trim()) return body
  return body.startsWith('\n') ? body : `\n${body}`
}

export interface SplitResult {
  /** frontmatter 解析结果；没有 frontmatter 时是空对象 */
  data: Record<string, unknown>
  /** 分隔符之后的原文，含它开头的空行 */
  body: string
  hasFrontmatter: boolean
}

/** 把文件内容切成 frontmatter + 正文。手写扫描不用大正则，正则写错会把正文吃掉 */
export function splitFrontmatter(input: string): SplitResult {
  // BOM 去掉再判断，否则开头的 `---` 认不出来
  const raw = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input

  if (!/^---[ \t]*\r?\n/.test(raw)) {
    return { data: {}, body: raw, hasFrontmatter: false }
  }

  const afterOpen = raw.indexOf('\n') + 1
  const rest = raw.slice(afterOpen)

  // 单独成行的 `---` 或 `...` 收尾。没有 m 标志，所以 `^` 只匹配 rest 的开头,
  // 正好覆盖「frontmatter 是空的」这种情况
  const close = /(?:^|\n)(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(rest)
  if (!close) {
    // 有开头没结尾：当作没有 frontmatter，正文原样保留，绝不猜
    return { data: {}, body: raw, hasFrontmatter: false }
  }

  const yamlText = rest.slice(0, close.index)
  const body = rest.slice(close.index + close[0].length)

  let data: Record<string, unknown> = {}
  if (yamlText.trim()) {
    const parsed = YAML.parse(yamlText) as unknown
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>
    }
  }

  return { data, body, hasFrontmatter: true }
}

/** 拼回完整文件内容，`body` 原样接在收尾分隔符之后。keyOrder 显式传，不给默认值 */
export function serializeFile(
  data: Record<string, unknown>,
  body: string,
  keyOrder: readonly string[],
): string {
  const ordered: Record<string, unknown> = {}

  for (const key of keyOrder) {
    if (key in data) ordered[key] = data[key]
  }
  // 未知字段排在已知字段后面，保持它们原本的相对顺序
  for (const [key, value] of Object.entries(data)) {
    if (!(key in ordered)) ordered[key] = value
  }

  const yamlText = YAML.stringify(ordered, {
    // 默认 80 列会把长 description 折成多行，diff 很难看
    lineWidth: 0,
    // 空值写成裸键（`tags:`）而不是 `tags: null`。
    // 仓库里确实有文章写着空的 `tags:`，写成 null 就等于改了人家的文件
    nullStr: '',
  })

  return `---\n${yamlText}---\n${body}`
}

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback

/** 标签分隔符和 blog/transformers/taxonomy.ts 对齐：半角/全角逗号和顿号，不切空格 */
const TAG_SEPARATORS = /[,，、]/

function asStringList(value: unknown): string[] {
  const parts =
    typeof value === 'string'
      ? value.split(TAG_SEPARATORS)
      : Array.isArray(value)
        ? value.flatMap((v) => (typeof v === 'string' ? v.split(TAG_SEPARATORS) : [asString(v)]))
        : []

  const seen = new Set<string>()
  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed) seen.add(trimmed)
  }
  return [...seen]
}

/** 只有日期 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
/** 日期 + 时刻（秒可有可无，`T` 或空格分隔都认） */
const DATE_TIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/
/** 结尾带时区（`Z` 或 `+08:00`） */
const HAS_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i

const pad = (n: number) => String(n).padStart(2, '0')

/** Date → 本地时间的 `YYYY-MM-DD HH:mm`（不用 toISOString，UTC 会把日期挪掉） */
function formatLocal(d: Date): string {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

// 把 date 归一成 `YYYY-MM-DD HH:mm`，老文章只写了日期就当成当天 `00:00`
// 刻意不带秒：`09:30:00` 会被 YAML 1.1 当成 UTC 时间戳，时区能把日期挪走
export function toDateTimeString(value: unknown): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : formatLocal(value)
  }

  const text = asString(value).trim()
  if (!text) return ''

  if (DATE_ONLY.test(text)) return `${text} 00:00`

  // 显式带时区的写法要真的换算到本地，不能只把墙上时间抄过来
  if (HAS_ZONE.test(text)) {
    const parsed = new Date(text)
    if (!Number.isNaN(parsed.getTime())) return formatLocal(parsed)
  }

  const matched = DATE_TIME.exec(text)
  if (matched) return `${matched[1]} ${matched[2]}:${matched[3]}`

  const parsed = new Date(text)
  // 实在认不出来就原样返回，不猜 —— 让保存时的校验去报错，别悄悄改人家的值
  return Number.isNaN(parsed.getTime()) ? text : formatLocal(parsed)
}

/** frontmatter → 前端要的规整结构 */
export function normalizeFrontmatter(data: Record<string, unknown>): PostFrontmatter {
  return {
    title: asString(data.title),
    description: asString(data.description),
    date: toDateTimeString(data.date),
    slug: asString(data.slug),
    path: asString(data.path),
    category: asString(data.category),
    tags: asStringList(data.tags),
    draft: data.draft === true,
    cover: asString(data.cover),
  }
}

/** schema 给了默认值或可省的字段：值为空时可以整个键都不写 */
const OMITTABLE = ['path', 'category', 'tags', 'draft', 'cover'] as const

/** 某个可省字段在这份 frontmatter 里算不算「空」 */
function isEmptyValue(fm: PostFrontmatter, key: (typeof OMITTABLE)[number]): boolean {
  switch (key) {
    case 'tags':
      return fm.tags.length === 0
    case 'draft':
      return fm.draft === false
    default:
      return fm[key] === ''
  }
}

// 前端提交的内容 → 写进文件的 frontmatter。空值默认不写，产出的文件和手写的一样干净
// 但原文里本来就有的空键（光秃秃的 `tags:`）要原样留着；原本有值、现在被用户清空的则不写
export function buildFrontmatter(
  fm: PostFrontmatter,
  raw: Record<string, unknown> = {},
): Record<string, unknown> {
  // schema 里必填的四个字段，一定写
  const data: Record<string, unknown> = {
    title: fm.title,
    description: fm.description,
    date: fm.date,
    slug: fm.slug,
  }

  // 日期同理：归一化后和原文一致就写回原值，否则每篇老文章一保存就被改掉一行
  if (typeof raw.date === 'string' && toDateTimeString(raw.date) === fm.date) {
    data.date = raw.date
  }

  const originalFm = normalizeFrontmatter(raw)

  for (const key of OMITTABLE) {
    if (!isEmptyValue(fm, key)) {
      data[key] = key === 'draft' ? true : fm[key]
      continue
    }
    // 现在是空的：只有「原文里有这个键、而且原本也是空的」才把原值抄回去
    if (key in raw && isEmptyValue(originalFm, key)) data[key] = raw[key]
  }

  // 后台不认识的字段原样带回去，排在已知字段后面
  const known = new Set<string>(POST_KEY_ORDER)
  for (const [key, value] of Object.entries(raw)) {
    if (!known.has(key) && !(key in data)) data[key] = value
  }

  return data
}

/* --------------------------------------------------------------------- 固定页 */

/** 一条友情链接。只挑认识的四个键，多余的丢掉 —— friends 整个数组由后台表单维护 */
function asFriend(value: unknown): FriendLink | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const item = value as Record<string, unknown>

  const name = asString(item.name).trim()
  const url = asString(item.url).trim()
  // 名字和网址都没有的条目就是空行，直接扔掉
  if (!name && !url) return null

  const avatar = asString(item.avatar).trim()
  return {
    name,
    url,
    description: asString(item.description).trim(),
    ...(avatar ? { avatar } : {}),
  }
}

function asFriendList(value: unknown): FriendLink[] {
  if (!Array.isArray(value)) return []
  return value.map(asFriend).filter((item): item is FriendLink => item !== null)
}

/** 页面 frontmatter → 前端要的规整结构 */
export function normalizePageFrontmatter(data: Record<string, unknown>): PageFrontmatter {
  return {
    title: asString(data.title),
    description: asString(data.description),
    friends: asFriendList(data.friends),
  }
}

// 写进文件的一条友链：空字段整个键都不写（yaml 会把空串写成 `""`，看着像有内容）
// 代价是手写的友链换了键序会被归一化，「打开不改再保存逐字节不变」只对后台产出的形状成立
function toStoredFriend(item: FriendLink): Record<string, unknown> {
  return {
    name: item.name,
    url: item.url,
    ...(item.description ? { description: item.description } : {}),
    ...(item.avatar ? { avatar: item.avatar } : {}),
  }
}

/** 前端提交的页面内容 → 写进文件的 frontmatter。同文章：空值不写，原有的空键留着 */
export function buildPageFrontmatter(
  fm: PageFrontmatter,
  raw: Record<string, unknown> = {},
): Record<string, unknown> {
  // title 是 schema 里唯一必填的，一定写
  const data: Record<string, unknown> = { title: fm.title }

  const originalFm = normalizePageFrontmatter(raw)
  const isEmpty = (value: PageFrontmatter, key: 'description' | 'friends') =>
    key === 'friends' ? value.friends.length === 0 : value.description === ''

  for (const key of ['description', 'friends'] as const) {
    if (!isEmpty(fm, key)) {
      data[key] = key === 'friends' ? fm.friends.map(toStoredFriend) : fm.description
      continue
    }
    if (key in raw && isEmpty(originalFm, key)) data[key] = raw[key]
  }

  // 后台不认识的字段原样带回去
  const known = new Set<string>(PAGE_KEY_ORDER)
  for (const [key, value] of Object.entries(raw)) {
    if (!known.has(key) && !(key in data)) data[key] = value
  }

  return data
}
