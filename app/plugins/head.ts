export default defineNuxtPlugin(() => {
  useHead({
    titleTemplate: title => (title ? `${title} - ${siteConfig.title}` : siteConfig.title),
    link: [
      {
        rel: 'alternate',
        type: 'application/rss+xml',
        title: `${siteConfig.title} 的 RSS`,
        href: '/feed.xml',
      },
    ],
  })
})
