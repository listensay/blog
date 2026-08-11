<script setup lang="ts">
defineProps<{
  tag: string
  /** 选中态：用于标签页高亮当前标签 */
  active?: boolean
}>()
</script>

<template>
  <NuxtLink
    :to="`/tags/${encodeURIComponent(tag)}`"
    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors"
    :class="active
      ? 'bg-brand-600 text-white hover:bg-brand-700'
      : 'bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700'"
  >
    {{ tag }}
  </NuxtLink>
</template>
