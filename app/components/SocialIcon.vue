<script setup lang="ts">
import {
  IconBrandBilibili,
  IconBrandDiscord,
  IconBrandGithub,
  IconBrandGitlab,
  IconBrandInstagram,
  IconBrandJuejin,
  IconBrandLinkedin,
  IconBrandNeteaseMusic,
  IconBrandQq,
  IconBrandSteam,
  IconBrandTelegram,
  IconBrandTiktok,
  IconBrandWechat,
  IconBrandWeibo,
  IconBrandX,
  IconBrandYoutube,
  IconBrandZhihu,
  IconMail,
  IconRss,
  IconWorld,
} from '@tabler/icons-vue'
import type { SocialIconName } from '~/utils/site'

const icons: Record<SocialIconName, typeof IconMail> = {
  email: IconMail,
  qq: IconBrandQq,
  wechat: IconBrandWechat,
  weibo: IconBrandWeibo,
  github: IconBrandGithub,
  gitlab: IconBrandGitlab,
  rss: IconRss,
  bilibili: IconBrandBilibili,
  zhihu: IconBrandZhihu,
  juejin: IconBrandJuejin,
  x: IconBrandX,
  telegram: IconBrandTelegram,
  discord: IconBrandDiscord,
  youtube: IconBrandYoutube,
  tiktok: IconBrandTiktok,
  instagram: IconBrandInstagram,
  linkedin: IconBrandLinkedin,
  steam: IconBrandSteam,
  netease: IconBrandNeteaseMusic,
  website: IconWorld,
}

defineProps<{ icon: SocialIconName }>()
</script>

<template>
  <component :is="icons[icon]" :size="22" stroke="1.8" aria-hidden="true" />
</template>
