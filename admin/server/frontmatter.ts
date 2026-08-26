import YAML from 'yaml'

import type { FriendLink, PageFrontmatter, PostFrontmatter } from '../src/types.ts'

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

export const PAGE_KEY_ORDER = ['title', 'description', 'friends'] as const

const MD_IMAGE_RE = /!\[[^\]]*\]\([^)]+\)/g
const HTML_IMAGE_RE = /<img\b/gi

export function countBodyImages(body: string): number {
  return (body.match(MD_IMAGE_RE)?.length ?? 0) + (body.match(HTML_IMAGE_RE)?.length ?? 0)
}

export function withLeadingBlankLine(body: string): string {
  if (!body.trim()) return body
  return body.startsWith('\n') ? body : `\n${body}`
}

export interface SplitResult {
  data: Record<string, unknown>
  body: string
  hasFrontmatter: boolean
}

export function splitFrontmatter(input: string): SplitResult {
  const raw = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input

  if (!/^---[ \t]*\r?\n/.test(raw)) {
    return { data: {}, body: raw, hasFrontmatter: false }
  }

  const afterOpen = raw.indexOf('\n') + 1
  const rest = raw.slice(afterOpen)

  const close = /(?:^|\n)(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(rest)
  if (!close) {
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

export function serializeFile(
  data: Record<string, unknown>,
  body: string,
  keyOrder: readonly string[],
): string {
  const ordered: Record<string, unknown> = {}

  for (const key of keyOrder) {
    if (key in data) ordered[key] = data[key]
  }
  for (const [key, value] of Object.entries(data)) {
    if (!(key in ordered)) ordered[key] = value
  }

  const yamlText = YAML.stringify(ordered, {
    lineWidth: 0,
    nullStr: '',
  })

  return `---\n${yamlText}---\n${body}`
}

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback

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

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const DATE_TIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/
const HAS_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i

const pad = (n: number) => String(n).padStart(2, '0')

function formatLocal(d: Date): string {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

export function toDateTimeString(value: unknown): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : formatLocal(value)
  }

  const text = asString(value).trim()
  if (!text) return ''

  if (DATE_ONLY.test(text)) return `${text} 00:00`

  if (HAS_ZONE.test(text)) {
    const parsed = new Date(text)
    if (!Number.isNaN(parsed.getTime())) return formatLocal(parsed)
  }

  const matched = DATE_TIME.exec(text)
  if (matched) return `${matched[1]} ${matched[2]}:${matched[3]}`

  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? text : formatLocal(parsed)
}

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

const OMITTABLE = ['path', 'category', 'tags', 'draft', 'cover'] as const

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

export function buildFrontmatter(
  fm: PostFrontmatter,
  raw: Record<string, unknown> = {},
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    title: fm.title,
    description: fm.description,
    date: fm.date,
    slug: fm.slug,
  }

  if (typeof raw.date === 'string' && toDateTimeString(raw.date) === fm.date) {
    data.date = raw.date
  }

  const originalFm = normalizeFrontmatter(raw)

  for (const key of OMITTABLE) {
    if (!isEmptyValue(fm, key)) {
      data[key] = key === 'draft' ? true : fm[key]
      continue
    }
    if (key in raw && isEmptyValue(originalFm, key)) data[key] = raw[key]
  }

  const known = new Set<string>(POST_KEY_ORDER)
  for (const [key, value] of Object.entries(raw)) {
    if (!known.has(key) && !(key in data)) data[key] = value
  }

  return data
}


function asFriend(value: unknown): FriendLink | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const item = value as Record<string, unknown>

  const name = asString(item.name).trim()
  const url = asString(item.url).trim()
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

export function normalizePageFrontmatter(data: Record<string, unknown>): PageFrontmatter {
  return {
    title: asString(data.title),
    description: asString(data.description),
    friends: asFriendList(data.friends),
  }
}

function toStoredFriend(item: FriendLink): Record<string, unknown> {
  return {
    name: item.name,
    url: item.url,
    ...(item.description ? { description: item.description } : {}),
    ...(item.avatar ? { avatar: item.avatar } : {}),
  }
}

export function buildPageFrontmatter(
  fm: PageFrontmatter,
  raw: Record<string, unknown> = {},
): Record<string, unknown> {
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

  const known = new Set<string>(PAGE_KEY_ORDER)
  for (const [key, value] of Object.entries(raw)) {
    if (!known.has(key) && !(key in data)) data[key] = value
  }

  return data
}
