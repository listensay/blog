<script setup lang="ts">
useHead({
  link: [
    {
      rel: 'alternate',
      type: 'application/rss+xml',
      title: `${siteConfig.title} 的 RSS`,
      href: '/feed.xml',
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
