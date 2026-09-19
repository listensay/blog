<script setup lang="ts">
import {
  IconArchive,
  IconArticle,
  IconBook,
  IconCategory,
  IconChevronDown,
  IconCode,
  IconCoffee,
  IconFileText,
  IconHeart,
  IconHome,
  IconLanguage,
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
const navigation = computed(() => siteConfig.nav.map(item => ({
  ...item,
  label: isEnglish.value ? item.labelEn : item.label,
  to: isEnglish.value && publishedPaths.value?.includes(localPath(item.to)) ? localPath(item.to) : item.to,
})))
const titleColors = ['#4285f4', '#ea4335', '#f9ab00', '#34a853', '#a855f7']
const languageMenu = ref<HTMLDetailsElement>()
const mounted = ref(false)
const currentPath = computed(() => mounted.value ? route.fullPath : route.fullPath.split('#')[0])
const languages = computed(() => [
  { code: 'zh-CN', label: t('languageChinese'), current: !isEnglish.value },
  { code: 'en', label: t('languageEnglish'), current: isEnglish.value },
])

function closeLanguageMenu(restoreFocus = false) {
  if (!languageMenu.value?.open) return
  languageMenu.value.open = false
  if (restoreFocus) languageMenu.value.querySelector('summary')?.focus()
}

function onOutsidePointerDown(event: PointerEvent) {
  if (event.target instanceof Node && !languageMenu.value?.contains(event.target)) closeLanguageMenu()
}

function onLanguageFocusOut(event: FocusEvent) {
  if (!(event.relatedTarget instanceof Node) || !languageMenu.value?.contains(event.relatedTarget)) closeLanguageMenu()
}

watch(() => route.fullPath, () => closeLanguageMenu())

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
  mounted.value = true
  document.addEventListener('pointerdown', onOutsidePointerDown)
  centerActiveItem(false)

  watch(() => route.path, () => {
    nextTick(() => centerActiveItem(!prefersReducedMotion()))
  })
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutsidePointerDown)
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
      <details
        ref="languageMenu"
        class="group relative col-start-2 row-start-1 shrink-0 lg:col-start-3"
        @keydown.esc.stop.prevent="closeLanguageMenu(true)"
        @focusout="onLanguageFocusOut"
      >
        <summary
          class="inline-flex min-h-10 cursor-pointer list-none items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white/70 px-3 text-sm leading-5 font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 group-open:border-slate-300 group-open:bg-white group-open:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 [&::-webkit-details-marker]:hidden"
        >
          <IconLanguage :size="18" stroke="1.8" aria-hidden="true" />
          <span lang="en">Language</span>
          <IconChevronDown :size="14" stroke="1.8" aria-hidden="true" class="transition-transform group-open:rotate-180" />
        </summary>
        <ul class="absolute right-0 top-full z-50 mt-2 w-36 space-y-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-md shadow-slate-900/10" aria-label="Language">
          <li v-for="language in languages" :key="language.code">
            <NuxtLink
              :to="language.current ? currentPath : switchPath"
              :hreflang="language.code"
              :lang="language.code"
              :aria-current="language.current ? 'true' : undefined"
              :title="language.current ? undefined : switchLabel"
              class="flex min-h-9 items-center rounded-md px-3 py-2 text-sm leading-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-slate-400"
              :class="language.current ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'"
              @click="closeLanguageMenu()"
            >
              {{ language.label }}
            </NuxtLink>
          </li>
        </ul>
      </details>
    </div>
  </header>
</template>
