<script setup lang="ts">
defineProps<{
  category: string
  /** 选中态：用于分类页高亮当前分类 */
  active?: boolean
}>()
</script>

<template>
  <NuxtLink
    :to="`/categories/${encodeURIComponent(category)}`"
    class="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors"
    :class="active
      ? 'bg-brand-600 text-white hover:bg-brand-700'
      : 'bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700'"
  >
    {{ category }}
  </NuxtLink>
</template>
