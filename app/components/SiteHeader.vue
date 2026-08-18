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

// 手机上导航是一条横向滑动的轨道，六项放不下。当前页对应的那一项可能被滑到了
// 视口外——看不见「我在哪」的导航等于没有导航，所以每次换路由把它挪到中间。
const track = ref<HTMLElement>()

function centerActiveItem(smooth: boolean) {
  const el = track.value
  // 只动轨道自己的 scrollLeft。不用 scrollIntoView：那个会连带滚动 window，
  // 在 sticky 头部里调用容易把整页顶上去。
  const active = el?.querySelector<HTMLElement>('[data-nav-active]')
  if (!el || !active) return
  // 桌面端不滑动（overflow 是 visible），scrollWidth 不会超出，这里直接跳过
  if (el.scrollWidth <= el.clientWidth) return

  el.scrollTo({
    left: active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2,
    behavior: smooth ? 'smooth' : 'auto',
  })
}

onMounted(() => {
  // 首屏不用动画，直接就位
  centerActiveItem(false)

  watch(() => route.path, () => {
    // 等激活态的 data-nav-active 渲染到新的那一项上再算位置
    nextTick(() => centerActiveItem(!prefersReducedMotion()))
  })
})
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
    <!-- 手机：标题居中一行、导航横滑一行；sm 起并成一行，标题回到左侧。
         py 2.5 + text-xl 让双行头部约 84px 高——仍在 prose 标题 scroll-mt-24
         （96px）之下，锚点跳转不会被头部盖住。再加高就得动那个值 -->
    <div
      class="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-2.5 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 sm:py-0"
    >
      <NuxtLink
        to="/"
        class="shrink-0 text-center text-xl font-semibold tracking-tight text-slate-900 transition-colors hover:text-brand-600 sm:text-left"
      >
        {{ siteConfig.title }}
      </NuxtLink>

      <!-- -mx-4 px-4 让滑动区一直延伸到屏幕边缘：内容仍与页面留白对齐，
           但截断发生在最边上，一眼能看出「右边还有」 -->
      <nav
        ref="track"
        class="no-scrollbar -mx-4 flex items-center gap-1 overflow-x-auto overscroll-x-contain px-4 text-sm sm:mx-0 sm:gap-2 sm:overflow-x-visible sm:px-0"
      >
        <NuxtLink
          v-for="item in siteConfig.nav"
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
          <!-- 图标常驻主题色；文字未激活时保持中性 slate -->
          <span class="shrink-0" :style="{ color: item.color }">
            <component :is="navIcons[item.icon]" :size="17" stroke="1.8" aria-hidden="true" />
          </span>
          {{ item.label }}
        </NuxtLink>
      </nav>
    </div>
  </header>
</template>
