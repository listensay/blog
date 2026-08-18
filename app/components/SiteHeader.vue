<script setup lang="ts">
// 图标组件必须留在 Vue 层（site.ts 会被服务端 feed 引入，不能带组件）；
// 颜色放在 site.ts 里可自由配置，这里用行内样式应用任意 hex
import { IconArticle, IconCategory, IconHome, IconLink, IconTag, IconUser } from '@tabler/icons-vue'
import type { NavItem } from '~/utils/site'

const route = useRoute()

const isActive = (to: string) => {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(to + '/')
}

const navIcons: Record<NavItem['icon'], typeof IconHome> = {
  home: IconHome,
  articles: IconArticle,
  categories: IconCategory,
  tags: IconTag,
  about: IconUser,
  links: IconLink,
}

/** #rrggbb → rgba(..., alpha)，用于激活态的淡色底色 */
function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value
  const num = Number.parseInt(full, 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
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
          class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors sm:px-3"
          :class="isActive(item.to)
            ? 'font-medium'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'"
          :style="isActive(item.to)
            ? { color: item.color, backgroundColor: hexToRgba(item.color, 0.1) }
            : undefined"
        >
          <!-- 图标常驻主题色；文字未激活时保持中性 slate -->
          <span class="shrink-0" :style="{ color: item.color }">
            <component :is="navIcons[item.icon]" :size="17" :stroke="1.8" aria-hidden="true" />
          </span>
          {{ item.label }}
        </NuxtLink>
      </nav>
    </div>
  </header>
</template>
