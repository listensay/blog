<script setup lang="ts">
const { count = 2 } = defineProps<{ count?: number }>()
</script>

<template>
  <div role="status" aria-busy="true" class="skeleton-group space-y-7">
    <span class="sr-only">正在加载评论…</span>

    <div v-for="i in count" :key="i" aria-hidden="true" class="flex gap-2.5 sm:gap-3">
      <div class="skeleton size-8 shrink-0 rounded-full sm:size-9" />
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <div class="skeleton h-4 w-20" />
          <div class="skeleton h-3 w-24" />
        </div>
        <div class="skeleton mt-3 h-4 w-full" />
        <div class="skeleton mt-2 h-4 w-2/3" />
      </div>
    </div>
  </div>
</template>
