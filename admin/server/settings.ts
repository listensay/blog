import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import type {
  CategoryOption,
  SettingsResponse,
  SiteSettings,
  SocialIconOption,
  SocialLink,
} from '../src/types.ts'
import { badRequest } from './http.ts'
import { type Workspace, ensureDir } from './paths.ts'
import { listPosts } from './posts.ts'

export const SOCIAL_ICONS: SocialIconOption[] = [
  { value: 'email', label: '邮箱' },
  { value: 'qq', label: 'QQ' },
  { value: 'wechat', label: '微信' },
  { value: 'weibo', label: '微博' },
  { value: 'github', label: 'GitHub' },
  { value: 'gitlab', label: 'GitLab' },
  { value: 'rss', label: 'RSS' },
  { value: 'bilibili', label: '哔哩哔哩' },
  { value: 'zhihu', label: '知乎' },
  { value: 'juejin', label: '掘金' },
  { value: 'x', label: 'X / Twitter' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'discord', label: 'Discord' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: '抖音 / TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: '领英' },
  { value: 'steam', label: 'Steam' },
  { value: 'netease', label: '网易云音乐' },
  { value: 'website', label: '个人主页' },
]

const ICON_VALUES = new Set(SOCIAL_ICONS.map((item) => item.value))

const COLOR_RE = /^#[0-9a-fA-F]{6}$/
const UTC_OFFSET_RE = /^[+-]\d{2}:\d{2}$/
const ASSET_RE = /^(\/|https?:\/\/)/i

const MAX_SOCIALS = 20
const MAX_HIDDEN = 20
const MAX_LABEL = 24
const MAX_NAME = 40
const MAX_TITLE = 60
const MAX_TEXT = 300
const MAX_POST_LIMIT = 50

export const DEFAULT_SETTINGS: SiteSettings = {
  profile: { name: '', bio: '', avatar: '', socials: [] },
  site: {
    title: '',
    description: '',
    url: '',
    ogImage: '',
    utcOffset: '+08:00',
    home: { postLimit: 5, hiddenCategories: [] },
  },
}

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw badRequest(`${label}应为对象`)
  }
  return value as Record<string, unknown>
}

function text(value: unknown, label: string, max: number, required = false): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) {
    if (required) throw badRequest(`${label}不能为空`)
    return ''
  }
  if (raw.length > max) throw badRequest(`${label}超出长度上限（最多 ${max} 个字符）`)
  return raw
}

function asset(value: unknown, label: string): string {
  const raw = text(value, label, 300)
  if (!raw) return ''
  if (!ASSET_RE.test(raw)) {
    throw badRequest(`${label}应为站内路径或 http 链接：${raw}`)
  }
  return raw
}

function asSocial(value: unknown, index: number): SocialLink | null {
  const at = `第 ${index + 1} 个社交链接`
  const item = asObject(value, at)

  const icon = typeof item.icon === 'string' ? item.icon.trim() : ''
  const label = typeof item.label === 'string' ? item.label.trim() : ''
  const url = typeof item.url === 'string' ? item.url.trim() : ''
  const color = typeof item.color === 'string' ? item.color.trim() : ''

  if (!label && !url && !color) return null

  if (!ICON_VALUES.has(icon)) throw badRequest(`${at}的图标无效：${icon || '（空）'}`)
  if (!label) throw badRequest(`${at}的名称不能为空`)
  if (label.length > MAX_LABEL)
    throw badRequest(`${at}的名称超出长度上限（最多 ${MAX_LABEL} 个字符）`)
  if (!url) throw badRequest(`${at}（${label}）的链接不能为空`)
  if (!/^(https?:\/\/|mailto:|tel:|\/)/i.test(url)) {
    throw badRequest(`${at}（${label}）的链接需以 http(s):// 、mailto: 、tel: 或 / 开头：${url}`)
  }
  if (!COLOR_RE.test(color)) {
    throw badRequest(`${at}（${label}）的颜色应为 #rrggbb：${color || '（空）'}`)
  }

  return { icon, label, url, color }
}

function asSocials(value: unknown): SocialLink[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw badRequest('社交链接应为数组')
  if (value.length > MAX_SOCIALS) throw badRequest(`社交链接最多 ${MAX_SOCIALS} 个`)

  const items = value.map(asSocial).filter((item): item is SocialLink => item !== null)

  const seen = new Set<string>()
  for (const item of items) {
    if (seen.has(item.url)) throw badRequest(`社交链接地址重复：${item.url}`)
    seen.add(item.url)
  }

  return items
}

function asHiddenCategories(value: unknown): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw badRequest('首页隐藏分类应为数组')
  if (value.length > MAX_HIDDEN) throw badRequest(`首页隐藏分类最多 ${MAX_HIDDEN} 个`)

  const items = value
    .map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : ''))
    .filter((item) => item.length > 0)

  for (const item of items) {
    if (!/^[a-z0-9-]+$/.test(item)) {
      throw badRequest(`首页隐藏分类应为英文 slug（小写字母、数字、连字符）：${item}`)
    }
  }

  return [...new Set(items)]
}

function asPostLimit(value: unknown): number {
  if (value === undefined || value === null || value === '')
    return DEFAULT_SETTINGS.site.home.postLimit
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(n) || n < 1 || n > MAX_POST_LIMIT) {
    throw badRequest(`首页文章条数应为 1 到 ${MAX_POST_LIMIT} 之间的整数：${String(value)}`)
  }
  return n
}

function asSiteUrl(value: unknown): string {
  const raw = text(value, '站点地址', 200, true)
  if (!/^https?:\/\/[^\s]+$/i.test(raw)) {
    throw badRequest(`站点地址应为完整的 http(s) 地址：${raw}`)
  }
  return raw.replace(/\/+$/, '')
}

function asUtcOffset(value: unknown): string {
  const raw = text(value, '时区偏移', 10) || DEFAULT_SETTINGS.site.utcOffset
  if (!UTC_OFFSET_RE.test(raw)) {
    throw badRequest(`时区偏移应为 +08:00：${raw}`)
  }
  return raw
}

export function validate(input: unknown): SiteSettings {
  const root = asObject(input, '设置')
  const profile = asObject(root.profile ?? {}, '个人资料')
  const site = asObject(root.site ?? {}, '网站设置')
  const home = asObject(site.home ?? {}, '首页设置')

  return {
    profile: {
      name: text(profile.name, '名字', MAX_NAME, true),
      bio: text(profile.bio, '个人简介', MAX_TEXT),
      avatar: asset(profile.avatar, '头像'),
      socials: asSocials(profile.socials),
    },
    site: {
      title: text(site.title, '网站标题', MAX_TITLE, true),
      description: text(site.description, '网站描述', MAX_TEXT),
      url: asSiteUrl(site.url),
      ogImage: asset(site.ogImage, '分享图'),
      utcOffset: asUtcOffset(site.utcOffset),
      home: {
        postLimit: asPostLimit(home.postLimit),
        hiddenCategories: asHiddenCategories(home.hiddenCategories),
      },
    },
  }
}

function fileLabel(ws: Workspace): string {
  return path.relative(ws.blogRoot, ws.siteFile).split(path.sep).join('/')
}

type SlugFn = (value: string, kind: 'category' | 'tag') => string

async function loadSlugFn(ws: Workspace): Promise<SlugFn | null> {
  try {
    const file = path.join(ws.blogRoot, 'app', 'utils', 'taxonomy.ts')
    const mod = (await import(pathToFileURL(file).href)) as { taxonomySlug?: unknown }
    return typeof mod.taxonomySlug === 'function' ? (mod.taxonomySlug as SlugFn) : null
  } catch {
    return null
  }
}

async function categoryOptions(ws: Workspace): Promise<CategoryOption[]> {
  const slugOf = await loadSlugFn(ws)
  if (!slugOf) return []

  try {
    const { categories } = await listPosts(ws)
    const seen = new Map<string, string>()
    for (const name of categories) {
      const slug = slugOf(name, 'category')
      if (!seen.has(slug)) seen.set(slug, name)
    }
    return [...seen].map(([slug, name]) => ({ value: slug, name }))
  } catch {
    return []
  }
}

function response(
  ws: Workspace,
  settings: SiteSettings,
  categories: CategoryOption[],
  extra: Partial<SettingsResponse> = {},
): SettingsResponse {
  return { settings, icons: SOCIAL_ICONS, categories, file: fileLabel(ws), ...extra }
}

export async function readSettings(ws: Workspace): Promise<SettingsResponse> {
  const categories = await categoryOptions(ws)

  try {
    const raw = await readFile(ws.siteFile, 'utf8')
    return response(ws, validate(JSON.parse(raw) as unknown), categories)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return response(ws, DEFAULT_SETTINGS, categories, { missing: true })
    }
    return response(ws, DEFAULT_SETTINGS, categories, {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

export async function writeSettings(ws: Workspace, input: unknown): Promise<SettingsResponse> {
  const settings = validate(input)

  ensureDir(path.dirname(ws.siteFile))
  await writeFile(ws.siteFile, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')

  return response(ws, settings, await categoryOptions(ws))
}
