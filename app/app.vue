<script setup lang="ts">
await useAsyncData('localized-paths', async () => {
  const [zhPosts, enPosts, zhPages, enPages] = await Promise.all([
    queryCollection('blog').where('draft', '=', false).select('path', 'category', 'tags').all(),
    queryCollection('blogEn').where('draft', '=', false).select('path', 'category', 'tags').all(),
    queryCollection('pages').select('path').all(),
    queryCollection('pagesEn').select('path').all(),
  ])
  return [...contentPaths('zh-CN', zhPosts, zhPages), ...contentPaths('en', enPosts, enPages)]
})

const { localPath, t } = useLocale()
useHead({
  link: [
    {
      rel: 'alternate',
      type: 'application/rss+xml',
      title: () => t('rssTitle', { site: siteConfig.title }),
      href: () => localPath('/feed.xml'),
    },
  ],
})
</script>

<template>
  <NuxtRouteAnnouncer />

  <NuxtLoadingIndicator
    :height="2"
    :throttle="100"
    color="var(--color-brand-500)"
  />

  <NuxtLayout>
    <NuxtPage :page-key="route => route.path" />
  </NuxtLayout>
</template>
