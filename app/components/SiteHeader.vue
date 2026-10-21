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
const navigation = siteConfig.nav
const isActive = (to: string) => {
  if (to === '/') return route.path === to
  return route.path === to || route.path.startsWith(to + '/')
}

const menu = useTemplateRef<HTMLElement>('menu')
const canScrollRight = ref(false)

function updateScrollHint() {
  const element = menu.value
  canScrollRight.value = !!element && element.scrollWidth - element.clientWidth - element.scrollLeft > 1
}

function revealMenuLink(link?: HTMLElement | null) {
  const element = menu.value
  if (!element || !link || getComputedStyle(element).flexDirection !== 'row') return
  const bounds = element.getBoundingClientRect()
  const item = link.getBoundingClientRect()
  const rightInset = link === element.lastElementChild ? 4 : 36
  if (item.left < bounds.left + 4) element.scrollLeft += item.left - bounds.left - 4
  else if (item.right > bounds.right - rightInset) element.scrollLeft += item.right - bounds.right + rightInset
  updateScrollHint()
}

function revealActiveLink() {
  revealMenuLink(menu.value?.querySelector<HTMLElement>('[aria-current="page"]'))
}

function onMenuFocus(event: FocusEvent) {
  if (event.target instanceof HTMLAnchorElement) revealMenuLink(event.target)
}

watch(() => route.path, async () => {
  await nextTick()
  revealActiveLink()
}, { flush: 'post' })

onMounted(() => {
  const observer = new ResizeObserver(() => {
    revealActiveLink()
    updateScrollHint()
  })
  if (menu.value) {
    observer.observe(menu.value)
    for (const link of menu.value.children) observer.observe(link)
  }
  onBeforeUnmount(() => observer.disconnect())
})

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

</script>

<template>
  <header class="site-navigation min-w-[0] lg:min-h-0 [border-right:1px_solid_var(--color-panel-line)] bg-[#10101f] max-md:[border-right:0] max-md:[border-bottom:1px_solid_var(--color-panel-line)]">
    <div class="
          navigation-inner sticky top-8 flex min-h-[calc(100svh-64px)] flex-col px-[18px] pt-[26px] pb-[22px] max-[1200px]:px-[12px]
          max-md:static max-md:min-h-[0] max-md:p-[18px_16px_12px] max-[1200px]:top-6 max-[1200px]:min-h-[calc(100svh-48px)]
          max-md:min-h-0 lg:static lg:h-full lg:min-h-0
          lg:overflow-y-auto lg:overscroll-y-contain lg:no-scrollbar
        ">
      <NuxtLink to="/" class="site-brand flex gap-[10px] items-center p-[0_6px]" :aria-label="siteConfig.title">
        <span class="brand-mark grid place-items-center w-[30px] h-[34px] text-panel bg-accent rounded-[12px_12px_9px_9px] text-[25px] font-black font-[Georgia,_serif] [transform:rotate(-8deg)]" aria-hidden="true">{{ [...siteConfig.author][0] }}</span>
        <span class="brand-name font-bold tracking-[-.5px] text-lg max-[1200px]:text-base max-md:text-lg">{{ siteConfig.title }}</span>
      </NuxtLink>
      <div class="relative min-w-0 pt-[46px] max-md:pt-[18px]">
        <nav ref="menu" class="navigation-menu flex flex-col gap-[9px] no-scrollbar max-md:flex-row max-md:gap-1 max-md:overflow-x-auto max-md:overscroll-x-contain max-md:py-1 max-md:px-1" aria-label="主菜单" @scroll.passive="updateScrollHint" @focusin="onMenuFocus">
          <NuxtLink
            v-for="item in navigation"
            :key="item.to"
            :to="item.to"
            :data-nav-active="isActive(item.to) ? '' : undefined"
            :aria-current="isActive(item.to) ? 'page' : undefined"
            class="
            navigation-link flex items-center gap-[14px] p-[10px_14px] rounded-[5px] transition-colors duration-150 text-base
            min-h-[48px] max-md:shrink-0 max-md:justify-center max-md:whitespace-nowrap max-md:text-sm max-md:gap-2 max-md:px-3 max-md:py-2 max-md:min-h-[44px]
            max-md:[&_svg]:w-[16px] max-md:[&_svg]:h-[16px]
          "
            :class="isActive(item.to) ? 'is-active bg-[#f4d47b12] text-accent hover:text-accent hover:bg-[#f4d47b12]' : 'text-[#b5b3c9] hover:text-white hover:bg-[#ffffff07]'"
          >
            <component :is="navIcons[item.icon]" :size="19" stroke="1.7" aria-hidden="true" />
            <span>{{ item.label }}</span>
            <span v-if="isActive(item.to)" class="navigation-dot w-[5px] h-[5px] ml-[auto] rounded-full bg-accent max-md:hidden" aria-hidden="true" />
          </NuxtLink>
        </nav>
        <div
          v-show="canScrollRight"
          aria-hidden="true"
          class="navigation-scroll-hint pointer-events-none absolute top-[18px] right-0 bottom-0 hidden w-8 bg-[#10101f]/80 backdrop-blur-[2px] [mask-image:linear-gradient(to_right,transparent,black)] max-md:block"
        />
      </div>
      <div class="navigation-bottom mt-auto pt-6 max-md:hidden">
        <DecorativeFlower class="navigation-flower block w-[56px] h-[56px] m-[0_18px_28px] text-[#b3ce8b] [transform:rotate(-12deg)] md:[@media(max-height:850px)]:hidden max-md:hidden" aria-hidden="true" />
      </div>
    </div>
  </header>
</template>
