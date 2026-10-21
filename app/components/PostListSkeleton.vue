<script setup lang="ts">
const { count = 5, mobileLayout = 'default' } = defineProps<{ count?: number, mobileLayout?: 'default' | 'light' }>()

const tailWidths = ['w-4/5', 'w-2/3', 'w-3/4', 'w-1/2', 'w-5/6']
</script>

<template>
  <div role="status" aria-busy="true" class="skeleton-group overflow-hidden rounded-none bg-transparent">
    <span class="sr-only">正在加载文章列表…</span>

    <div
      v-for="i in count"
      :key="i"
      aria-hidden="true"
      class="border-b border-panel-line px-4 py-5 last:border-none sm:px-6 sm:py-7"
      :class="mobileLayout === 'light' ? 'max-md:px-0 max-md:py-6' : ''"
    >
      <div v-if="mobileLayout === 'light'" class="grid grid-cols-[minmax(0,_1fr)_56px] items-start gap-4 md:hidden">
        <div class="min-w-0">
          <div class="skeleton h-5 w-full" />
          <div class="skeleton mt-2 h-5 w-4/5" />
          <div class="skeleton mt-3 h-4 w-32 max-w-full" />
        </div>
        <div class="skeleton mt-1 size-14" />
      </div>
      <div :class="mobileLayout === 'light' ? 'max-md:hidden' : ''">
        <div class="flex items-center gap-3">
          <div class="skeleton h-4 w-24" />
          <div class="skeleton h-4 w-16" />
        </div>
        <div class="skeleton mt-3.5 h-6 w-3/5" />
        <div class="skeleton mt-3 h-4 w-full" />
        <div class="skeleton mt-2 h-4" :class="tailWidths[(i - 1) % tailWidths.length]" />
      </div>
    </div>
  </div>
</template>
