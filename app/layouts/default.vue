<script setup lang="ts">
import BackToTop from '~/components/BackToTop.vue'
import { IconChevronRight, IconHome } from '@tabler/icons-vue'

const route = useRoute()
const isHome = computed(() => route.path === '/')
const mainContent = useTemplateRef<HTMLElement>('mainContent')
const currentPage = computed(() => siteConfig.nav.find(item => item.to === route.path
  || (item.to !== '/' && route.path.startsWith(`${item.to}/`)))?.label ?? '页面')

watch(() => route.path, () => {
  mainContent.value?.scrollTo({ top: 0, behavior: 'auto' })
}, { flush: 'post' })
</script>

<template>
  <div class="
          site-shell grid grid-cols-[204px_minmax(0,_1fr)] bg-panel text-panel-text [box-shadow:0_20px_65px_#222c2926]
          [border:1px_solid_#ffffff1a] rounded-sm leading-[1.6] w-[calc(100%_-_64px)] max-w-[1600px] min-h-[calc(100svh_-_64px)]
          m-[32px_auto] text-base max-[1200px]:grid-cols-[178px_minmax(0,_1fr)] max-[1200px]:w-[calc(100%_-_40px)]
          max-[1200px]:my-[24px] max-[1200px]:min-h-[calc(100svh_-_48px)] max-md:block max-md:w-[calc(100%_-_24px)]
          max-md:m-[12px_auto] max-md:min-h-[calc(100svh_-_24px)]
          lg:h-[calc(100dvh_-_64px)] lg:max-[1200px]:h-[calc(100dvh_-_48px)] lg:!min-h-0 lg:overflow-hidden
        " :data-home="isHome ? '' : undefined" :class="{ 'site-shell-home': isHome }">
    <SiteHeader />
    <div class="site-workspace lg:min-h-0 min-w-[0] flex flex-col">
      <header class="workspace-header h-[78px] flex shrink-0 justify-between items-center p-[0_28px] max-[1200px]:px-[20px] max-md:hidden">
        <nav class="workspace-breadcrumb flex items-center gap-[14px] text-panel-muted text-sm [&_span]:text-[#dbd8e9] [&_a:hover]:text-accent" aria-label="当前位置">
          <NuxtLink to="/" aria-label="首页"><IconHome :size="17" stroke="1.7" /></NuxtLink>
          <IconChevronRight :size="14" aria-hidden="true" />
          <span>{{ currentPage }}</span>
        </nav>
        <div class="workspace-actions flex items-center gap-[15px] max-md:gap-[12px]">
          <NuxtLink to="/about" class="workspace-profile flex items-center gap-[12px] text-[#c9c6d6] text-sm [&_img]:w-[30px] [&_img]:h-[30px] [&_img]:object-cover max-md:[&_span]:hidden" :aria-label="`关于 ${siteConfig.author}`">
            <span>{{ siteConfig.author }}</span>
            <img :src="siteConfig.avatar" alt="" width="30" height="30">
          </NuxtLink>
        </div>
      </header>
      <div class="
          workspace-columns lg:min-h-0 grid p-[0_26px_0_28px] gap-[24px] items-start flex-1
          grid-cols-[minmax(0,_1fr)_252px] max-[1200px]:px-[20px] max-[1200px]:gap-[18px] max-[1200px]:grid-cols-[minmax(0,_1fr)_208px]
          max-lg:grid-cols-[minmax(0,_1fr)] max-md:px-[16px] max-[360px]:px-[12px] lg:items-stretch
        ">
        <main id="main-content" ref="mainContent" class="
          site-content no-scrollbar relative lg:min-h-0 lg:overflow-y-auto lg:overscroll-y-contain
          min-w-[0] [&>:is(div,article):not(.home-page,.article-page)]:pt-1.5
          [&>:is(div,article):not(.home-page,.article-page)]:pb-5
        " tabindex="0" :aria-label="isHome ? '首页内容' : `${currentPage}内容`">
          <slot />
        </main>
        <SiteSidebar />
      </div>
      <SiteFooter />
    </div>
    <BackToTop :scroll-container="mainContent" />
  </div>
</template>
