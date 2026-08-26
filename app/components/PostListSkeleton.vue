<script setup lang="ts">
const { count = 5 } = defineProps<{ count?: number }>()

const tailWidths = ['w-4/5', 'w-2/3', 'w-3/4', 'w-1/2', 'w-5/6']
</script>

<template>
  <div role="status" aria-busy="true" class="skeleton-group overflow-hidden rounded-2xl bg-white shadow">
    <span class="sr-only">正在加载文章列表…</span>

    <div
      v-for="i in count"
      :key="i"
      aria-hidden="true"
      class="border-b border-zinc-100 px-4 py-5 last:border-none sm:px-6 sm:py-7"
    >
      <div class="flex items-center gap-3">
        <div class="skeleton h-4 w-24" />
        <div class="skeleton h-4 w-16" />
      </div>
      <div class="skeleton mt-3.5 h-6 w-3/5" />
      <div class="skeleton mt-3 h-4 w-full" />
      <div class="skeleton mt-2 h-4" :class="tailWidths[(i - 1) % tailWidths.length]" />
    </div>
  </div>
</template>
