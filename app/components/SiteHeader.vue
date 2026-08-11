<script setup lang="ts">
const route = useRoute()

const isActive = (to: string) => {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(to + '/')
}
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
    <div class="mx-auto flex h-16 max-w-5xl items-center justify-between gap-6 px-4 sm:px-6">
      <NuxtLink
        to="/"
        class="text-lg font-semibold tracking-tight text-slate-900 transition-colors hover:text-brand-600"
      >
        {{ siteConfig.title }}
      </NuxtLink>

      <nav class="flex items-center gap-1 text-sm sm:gap-2">
        <NuxtLink
          v-for="item in siteConfig.nav"
          :key="item.to"
          :to="item.to"
          class="rounded-lg px-2.5 py-1.5 transition-colors sm:px-3"
          :class="isActive(item.to)
            ? 'bg-brand-50 font-medium text-brand-700'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>
    </div>
  </header>
</template>
