<script setup lang="ts">
import {
  IconArchive,
  IconArticle,
  IconBook,
  IconCategory,
  IconCode,
  IconCoffee,
  IconFileText,
  IconHeart,
  IconHome,
  IconLink,
  IconMail,
  IconMessage,
  IconPhoto,
  IconRss,
  IconSparkles,
  IconStar,
  IconTag,
  IconTerminal2,
  IconUser,
  IconWorld,
} from '@tabler/icons-vue'
import type { NavIcon } from '~/utils/site'

const route = useRoute()
const { isEnglish, localPath, switchPath, switchLabel, publishedPaths, t } = useLocale()
const navKeys: Record<string, string> = { '/': 'home', '/blog': 'articles', '/categories': 'categories', '/tags': 'tags', '/about': 'about', '/links': 'links' }
const navigation = computed(() => siteConfig.nav.map(item => ({
  ...item,
  label: isEnglish.value && navKeys[item.to] ? t(`nav.${navKeys[item.to]}`) : item.label,
  to: isEnglish.value && publishedPaths.value?.includes(localPath(item.to)) ? localPath(item.to) : item.to,
})))
const titleColors = ['#4285f4', '#ea4335', '#f9ab00', '#34a853', '#a855f7']

const isActive = (to: string) => {
  if (to === '/' || to === '/en') return route.path === to
  return route.path === to || route.path.startsWith(to + '/')
}

const navIcons: Record<NavIcon, typeof IconHome> = {
  home: IconHome,
  articles: IconArticle,
  categories: IconCategory,
  tags: IconTag,
  about: IconUser,
  links: IconLink,
  page: IconFileText,
  book: IconBook,
  star: IconStar,
  heart: IconHeart,
  mail: IconMail,
  message: IconMessage,
  photo: IconPhoto,
  code: IconCode,
  rss: IconRss,
  world: IconWorld,
  sparkles: IconSparkles,
  coffee: IconCoffee,
  terminal: IconTerminal2,
  archive: IconArchive,
}

function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value
  const num = Number.parseInt(full, 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const track = ref<HTMLElement>()

function centerActiveItem(smooth: boolean) {
  const el = track.value
  const active = el?.querySelector<HTMLElement>('[data-nav-active]')
  if (!el || !active) return
  if (el.scrollWidth <= el.clientWidth) return

  el.scrollTo({
    left: active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2,
    behavior: smooth ? 'smooth' : 'auto',
  })
}

onMounted(() => {
  centerActiveItem(false)

  watch(() => route.path, () => {
    nextTick(() => centerActiveItem(!prefersReducedMotion()))
  })
})
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-white/60 bg-white/55 shadow-sm shadow-slate-900/5 backdrop-blur-xl backdrop-saturate-150">
    <div
      class="mx-auto grid max-w-5xl grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 lg:h-16 lg:grid-cols-[auto_1fr_auto] lg:gap-4 lg:px-6 lg:py-0"
    >
      <NuxtLink
        :to="localPath('/')"
        class="shrink-0 text-xl font-semibold tracking-tight transition-opacity hover:opacity-80"
        :aria-label="siteConfig.title"
      >
        <span
          v-for="(char, index) in [...siteConfig.title]"
          :key="`${char}-${index}`"
          aria-hidden="true"
          :style="{ color: titleColors[index % titleColors.length] }"
        >{{ char }}</span>
      </NuxtLink>

      <nav
        ref="track"
        class="no-scrollbar col-span-2 row-start-2 -mx-4 flex items-center gap-1 overflow-x-auto overscroll-x-contain px-4 text-sm lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:mx-0 lg:justify-end lg:px-0"
      >
        <NuxtLink
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          :data-nav-active="isActive(item.to) ? '' : undefined"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 whitespace-nowrap transition-colors sm:px-3"
          :class="isActive(item.to)
            ? 'font-medium'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'"
          :style="isActive(item.to)
            ? { color: item.color, backgroundColor: hexToRgba(item.color, 0.1) }
            : undefined"
        >
          <span class="shrink-0" :style="{ color: item.color }">
            <component :is="navIcons[item.icon]" :size="17" stroke="1.8" aria-hidden="true" />
          </span>
          {{ item.label }}
        </NuxtLink>
      </nav>
      <NuxtLink
        :to="switchPath"
        :aria-label="switchLabel"
        :title="switchLabel"
        :hreflang="isEnglish ? 'zh-CN' : 'en'"
        :lang="isEnglish ? 'zh-CN' : 'en'"
        class="col-start-2 row-start-1 inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white/70 px-3 text-sm font-medium text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 lg:col-start-3"
      >
        <IconWorld :size="17" stroke="1.8" aria-hidden="true" />
        {{ t(isEnglish ? 'languageChinese' : 'languageEnglish') }}
      </NuxtLink>
    </div>
  </header>
</template>
