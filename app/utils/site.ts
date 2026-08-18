/**
 * 社交链接：首页简介下方展示为图标。
 * url 留空则对应图标不显示；想加社区就在数组里加一项，
 * 并在 SocialIcon.vue 里补一个对应 icon 的 Tabler 图标映射。
 */
export interface SocialLink {
  /** 图标标识，对应 SocialIcon.vue 里的 Tabler 图标 */
  icon: 'qq' | 'email' | 'github' | 'rss'
  /** 无障碍标签与悬浮提示 */
  label: string
  url: string
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
  socials: [
    { icon: 'qq', label: 'QQ 群', url: 'https://qm.qq.com/q/pa2mcYXCCc' },
    { icon: 'email', label: '邮箱', url: 'mailto:odr233@gmail.com' },
    { icon: 'github', label: 'GitHub', url: 'https://github.com/listensay' },
    { icon: 'rss', label: 'RSS 订阅', url: '/feed.xml' },
  ] satisfies SocialLink[],
  nav: [
    { label: 'Home', to: '/' },
    { label: 'Articles', to: '/blog' },
    { label: 'Categories', to: '/categories' },
    { label: 'Tags', to: '/tags' },
    { label: 'About', to: '/about' },
    { label: 'Links', to: '/links' }
  ],
}
