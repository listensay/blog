import navData from '../../content/data/nav.json'

export interface SocialLink {
  icon: 'qq' | 'email' | 'github' | 'rss'
  label: string
  url: string
  color: string
}

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

export interface NavItem {
  label: string
  to: string
  icon: NavIcon
  color: string
}

const FALLBACK_ICON: NavIcon = 'page'
const FALLBACK_COLOR = '#64748b'

function toNavItem(raw: { label: string, to: string, icon: string, color: string }): NavItem | null {
  const label = typeof raw.label === 'string' ? raw.label.trim() : ''
  const to = typeof raw.to === 'string' ? raw.to.trim() : ''
  if (!label || !to) return null

  const icon = (NAV_ICONS as readonly string[]).includes(raw.icon)
    ? (raw.icon as NavIcon)
    : FALLBACK_ICON

  return {
    label,
    to,
    icon,
    color: /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : FALLBACK_COLOR,
  }
}

export const siteConfig = {
  title: 'Immki Blog',
  description: '了解真相才能获得真正的自由。',
  author: 'Immki',
  url: 'https://blog.200205.net',
  utcOffset: '+08:00',
  ogImage: '/images/avatar.jpg',
  home: {
    postLimit: 5,
    hiddenCategories: ['docs'],
  },
  socials: [
    { icon: 'qq', label: 'QQ 群', url: 'https://qm.qq.com/q/pa2mcYXCCc', color: '#12B7F5' },
    { icon: 'email', label: '邮箱', url: 'mailto:odr233@gmail.com', color: '#ea4335' },
    { icon: 'github', label: 'GitHub', url: 'https://github.com/listensay', color: '#24292f' },
    { icon: 'rss', label: 'RSS 订阅', url: '/feed.xml', color: '#ee802f' },
  ] satisfies SocialLink[],
  nav: navData.map(toNavItem).filter((item): item is NavItem => item !== null),
}
