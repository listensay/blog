/**
 * 社交链接：首页简介下方展示为图标。
 * url 留空则对应图标不显示；想加社区就在数组里加一项，
 * 并在 SocialIcon.vue 里补一个对应 icon 的 Tabler 图标映射。
 * color 是主题色，任意 hex（#rrggbb）：图标常驻此色，hover 时底色描边也用同色
 */
export interface SocialLink {
  /** 图标标识，对应 SocialIcon.vue 里的 Tabler 图标 */
  icon: 'qq' | 'email' | 'github' | 'rss'
  /** 无障碍标签与悬浮提示 */
  label: string
  url: string
  color: string
}

/**
 * 顶部导航项。icon 对应 SiteHeader.vue 里的 Tabler 图标；
 * color 是主题色，任意 hex（#rrggbb）：图标常驻此色，激活时底色与文字也用同色
 */
export interface NavItem {
  label: string
  to: string
  icon: 'home' | 'articles' | 'categories' | 'tags' | 'about' | 'links'
  color: string
}

/**
 * 站点级配置：导航、标题、页脚等集中在这里，改一处即可
 */
export const siteConfig = {
  title: 'Immki Blog',
  description: '了解真相才能获得真正的自由。',
  author: 'Immki',
  /** 站点域名：RSS 等需要绝对链接的地方都从这里取 */
  url: 'https://blog.200205.net',
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
  nav: [
    { label: 'Home', to: '/', icon: 'home', color: '#3b82f6' },
    { label: 'Articles', to: '/blog', icon: 'articles', color: '#10b981' },
    { label: 'Categories', to: '/categories', icon: 'categories', color: '#8b5cf6' },
    { label: 'Tags', to: '/tags', icon: 'tags', color: '#f59e0b' },
    { label: 'About', to: '/about', icon: 'about', color: '#06b6d4' },
    { label: 'Links', to: '/links', icon: 'links', color: '#f43f5e' },
  ] satisfies NavItem[],
}
