<template>
  <NuxtRouteAnnouncer />

  <!-- 路由切换时顶部走一条细进度条。throttle 压到 100ms：本站换页基本秒回，
       用默认的 200ms 几乎看不到，反而像页面抖了一下 -->
  <NuxtLoadingIndicator
    :height="2"
    :throttle="100"
    color="var(--color-brand-500)"
  />

  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
