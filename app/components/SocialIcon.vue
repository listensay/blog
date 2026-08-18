<script setup lang="ts">
// Mantine 自带的组件图标就是 Tabler 图标集，这里直接用其官方 Vue 版，不再手写 SVG。
// 想加新社区图标：在 site.ts 加一项，再在这里补一个映射即可。
import { IconBrandGithub, IconBrandQq, IconMail, IconRss } from '@tabler/icons-vue'
import type { SocialLink } from '~/utils/site'

const icons: Record<SocialLink['icon'], typeof IconMail> = {
  qq: IconBrandQq,
  email: IconMail,
  github: IconBrandGithub,
  rss: IconRss,
}

defineProps<{ icon: SocialLink['icon'] }>()
</script>

<template>
  <component :is="icons[icon]" :size="22" :stroke="1.8" aria-hidden="true" />
</template>
