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
      <nav class="navigation-menu flex flex-col gap-[9px] pt-[46px] max-md:grid max-md:grid-cols-[repeat(4,_minmax(0,_1fr))] max-md:gap-[5px] max-md:pt-[18px]" aria-label="主菜单">
        <NuxtLink
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          :data-nav-active="isActive(item.to) ? '' : undefined"
          :aria-current="isActive(item.to) ? 'page' : undefined"
          class="
          navigation-link flex items-center gap-[14px] p-[10px_14px] rounded-[5px] transition-colors duration-150 text-base
          min-h-[48px] max-md:justify-center max-md:text-sm max-md:gap-[6px] max-md:p-[8px_4px] max-md:min-h-[44px]
          max-[360px]:gap-[5px] max-[360px]:px-[4px] max-md:[&_svg]:w-[16px] max-md:[&_svg]:h-[16px]
        "
          :class="isActive(item.to) ? 'is-active bg-[#f4d47b12] text-accent hover:text-accent hover:bg-[#f4d47b12]' : 'text-[#b5b3c9] hover:text-white hover:bg-[#ffffff07]'"
        >
          <component :is="navIcons[item.icon]" :size="19" stroke="1.7" aria-hidden="true" />
          <span>{{ item.label }}</span>
          <span v-if="isActive(item.to)" class="navigation-dot w-[5px] h-[5px] ml-[auto] rounded-full bg-accent max-md:hidden" aria-hidden="true" />
        </NuxtLink>
      </nav>
      <div class="navigation-bottom mt-auto pt-6 max-md:hidden">
        <DecorativeFlower class="navigation-flower block w-[56px] h-[56px] m-[0_18px_28px] text-[#b3ce8b] [transform:rotate(-12deg)] md:[@media(max-height:850px)]:hidden max-md:hidden" aria-hidden="true" />
      </div>
    </div>
  </header>
</template>
