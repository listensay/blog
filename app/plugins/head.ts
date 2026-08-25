// 全站 head 默认值。放插件而不是 app.vue：出错时 error.vue 会整体替换 app.vue，
// 写在那儿的 useHead 在错误页不执行，404 的标题会丢掉站点名
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
