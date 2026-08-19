/**
 * 全站 head 默认值。
 *
 * 为什么放在插件里而不是 app.vue：出错时 Nuxt 会用 error.vue **整体替换** app.vue，
 * 写在 app.vue 里的 useHead 在错误页上根本不会执行 —— 实测 404 页的标题会变成
 * 光秃秃的「页面不存在」，丢掉站点名。插件对两者都生效。
 */
export default defineNuxtPlugin(() => {
  useHead({
    // 内页是「页面标题 - 站点名」，首页（没给页面标题）只显示站点名
    titleTemplate: title => (title ? `${title} - ${siteConfig.title}` : siteConfig.title),
    link: [
      // 让浏览器和阅读器能自动发现订阅源
      {
        rel: 'alternate',
        type: 'application/rss+xml',
        title: `${siteConfig.title} 的 RSS`,
        href: '/feed.xml',
      },
    ],
  })
})
