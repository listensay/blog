<script setup lang="ts">
import { taxonomyLink } from '../utils/taxonomy'

defineProps<{
  category: string
  light?: boolean
}>()
</script>

<!-- 分类刻意做成纯文字链接：它和标签是两种不同的东西，长得一样反而看不出区别。
     色块留给标签，分类靠字重比旁边的日期重一点来区分。 -->
<template>
  <NuxtLink
    :to="taxonomyLink('categories', category)"
    class="font-medium underline-offset-4 transition-colors"
    :class="light ? 'text-white hover:text-white/80' : 'text-slate-600 hover:text-brand-600'"
  >
    {{ category }}
  </NuxtLink>
</template>
