import navData from '../../content/data/nav.json'
import siteData from '../../content/data/site.json'

export const NAV_ICONS = [
  'home',
  'articles',
  'categories',
  'tags',
  'about',
  'links',
  'page',
  'book',
  'star',
  'heart',
  'mail',
  'message',
  'photo',
  'code',
  'rss',
  'world',
  'sparkles',
  'coffee',
  'terminal',
  'archive',
] as const

export type NavIcon = (typeof NAV_ICONS)[number]

export const SOCIAL_ICONS = [
  'email',
  'qq',
  'wechat',
  'weibo',
  'github',
  'gitlab',
  'rss',
  'bilibili',
  'zhihu',
  'juejin',
  'x',
  'telegram',
  'discord',
  'youtube',
  'tiktok',
  'instagram',
  'linkedin',
  'steam',
  'netease',
  'website',
] as const

export type SocialIconName = (typeof SOCIAL_ICONS)[number]

export interface SocialLink {
  icon: SocialIconName
  label: string
  url: string
  color: string
}

export interface NavItem {
  label: string
  to: string
  icon: NavIcon
  color: string
}

const FALLBACK_ICON: NavIcon = 'page'
const FALLBACK_SOCIAL_ICON: SocialIconName = 'website'
const FALLBACK_COLOR = '#64748b'

const COLOR_RE = /^#[0-9a-f]{6}$/i

const DEFAULTS = {
  title: 'Blog',
  description: '',
  name: 'Anonymous',
  bio: '',
  avatar: '/images/avatar.jpg',
  url: 'http://localhost:3000',
  utcOffset: '+08:00',
  ogImage: '/images/avatar.jpg',
  postLimit: 5,
} as const

function str(value: unknown, fallback: string): string {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || fallback
}

function assetPath(value: unknown, fallback: string): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return fallback
  return text.startsWith('/') || /^https?:\/\//i.test(text) ? text : fallback
}

function color(value: unknown): string {
  return typeof value === 'string' && COLOR_RE.test(value.trim()) ? value.trim() : FALLBACK_COLOR
}

function toNavItem(raw: unknown): NavItem | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>

  const label = typeof item.label === 'string' ? item.label.trim() : ''
  const to = typeof item.to === 'string' ? item.to.trim() : ''
  if (!label || !to) return null

  return {
    label,
    to,
    icon: (NAV_ICONS as readonly string[]).includes(item.icon as string)
      ? (item.icon as NavIcon)
      : FALLBACK_ICON,
    color: color(item.color),
  }
}

function toSocialLink(raw: unknown): SocialLink | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>

  const url = typeof item.url === 'string' ? item.url.trim() : ''
  if (!url) return null

  const icon = (SOCIAL_ICONS as readonly string[]).includes(item.icon as string)
    ? (item.icon as SocialIconName)
    : FALLBACK_SOCIAL_ICON

  return {
    icon,
    label: str(item.label, icon),
    url,
    color: color(item.color),
  }
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(item => item.length > 0)
}

function toPostLimit(value: unknown): number {
  const n = typeof value === 'number' ? Math.floor(value) : Number.NaN
  return Number.isFinite(n) && n > 0 ? Math.min(n, 50) : DEFAULTS.postLimit
}

function toSiteUrl(value: unknown): string {
  const text = typeof value === 'string' ? value.trim().replace(/\/+$/, '') : ''
  return /^https?:\/\/[^\s]+$/i.test(text) ? text : DEFAULTS.url
}

function toUtcOffset(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : ''
  return /^[+-]\d{2}:\d{2}$/.test(text) ? text : DEFAULTS.utcOffset
}

const raw = siteData as Record<string, unknown>
const profileRaw = (raw.profile ?? {}) as Record<string, unknown>
const siteRaw = (raw.site ?? {}) as Record<string, unknown>
const homeRaw = (siteRaw.home ?? {}) as Record<string, unknown>

const description = str(siteRaw.description, DEFAULTS.description)

const profile = {
  name: str(profileRaw.name, DEFAULTS.name),
  bio: str(profileRaw.bio, description || DEFAULTS.bio),
  avatar: assetPath(profileRaw.avatar, DEFAULTS.avatar),
  socials: (Array.isArray(profileRaw.socials) ? profileRaw.socials : [])
    .map(toSocialLink)
    .filter((item): item is SocialLink => item !== null),
}

export const siteConfig = {
  title: str(siteRaw.title, DEFAULTS.title),
  description,
  url: toSiteUrl(siteRaw.url),
  utcOffset: toUtcOffset(siteRaw.utcOffset),
  ogImage: assetPath(siteRaw.ogImage, DEFAULTS.ogImage),
  home: {
    postLimit: toPostLimit(homeRaw.postLimit),
    hiddenCategories: toStringList(homeRaw.hiddenCategories),
  },
  profile,
  author: profile.name,
  bio: profile.bio,
  avatar: profile.avatar,
  socials: profile.socials,
  nav: navData.map(toNavItem).filter((item): item is NavItem => item !== null),
}
