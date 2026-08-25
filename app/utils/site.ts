/** 菜单数据，由后台的「菜单管理」维护。静态 import 的硬依赖，删了连 dev server 都起不来 */
import navData from '../../content/data/nav.json'

// 社交链接：首页简介下方展示为图标，加一项要同时在 SocialIcon.vue 补对应的 Tabler 图标映射
// color 是主题色，任意 hex（#rrggbb）：图标常驻此色，hover 时底色描边也用同色
export interface SocialLink {
  /** 图标标识，对应 SocialIcon.vue 里的 Tabler 图标 */
  icon: 'qq' | 'email' | 'github' | 'rss'
  /** 无障碍标签与悬浮提示 */
  label: string
  url: string
  color: string
}

// 菜单能用的图标名，每一个都要在 SiteHeader.vue 的 navIcons 里有对应图标，漏一个类型报错
// 后台的图标下拉另有一份同样的列表（admin/server/nav.ts），加图标要两边一起加
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

/** 顶部导航项。icon 对应 SiteHeader.vue 里的 Tabler 图标，color 是任意 hex 主题色（#rrggbb） */
export interface NavItem {
  label: string
  to: string
  icon: NavIcon
  color: string
}

/** 图标名和颜色不认识时的兜底值 */
const FALLBACK_ICON: NavIcon = 'page'
const FALLBACK_COLOR = '#64748b'

// nav.json 一条 → NavItem。顶栏每页都渲染，坏一条是整站：图标名或颜色不认识就换兜底值，
// 没有文字或路径就整条丢掉——`<NuxtLink :to="undefined">` 直接抛错，那是整站白屏
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

/** 站点级配置：导航、标题、页脚等集中在这里，改一处即可 */
export const siteConfig = {
  title: 'Immki Blog',
  description: '了解真相才能获得真正的自由。',
  author: 'Immki',
  /** 站点域名：RSS 等需要绝对链接的地方都从这里取 */
  url: 'https://blog.200205.net',
  /** 文章 date 那个「墙上时间」所属的时区偏移。不补上它，RSS、og:published_time 里的时刻就是错的 */
  utcOffset: '+08:00',
  /** 社交卡片默认图（og:image / twitter:image）。文章可用 frontmatter 的 cover 覆盖 */
  ogImage: '/images/avatar.jpg',
  home: {
    postLimit: 5,
    // 使用分类的英文 slug；这些分类不会出现在首页列表和筛选项中。
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
