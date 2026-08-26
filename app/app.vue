<template>
  <NuxtRouteAnnouncer />

  <NuxtLoadingIndicator
    :height="2"
    :throttle="100"
    color="var(--color-brand-500)"
  />

  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
