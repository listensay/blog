<script setup lang="ts">
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
  <component :is="icons[icon]" :size="22" stroke="1.8" aria-hidden="true" />
</template>
