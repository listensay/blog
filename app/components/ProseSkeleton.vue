<script setup lang="ts">
/**
 * 正文段落的骨架屏。行宽按「段落最后一行更短」的规律排，
 * 比等宽色块更像一篇文章。
 */
const { paragraphs = 3 } = defineProps<{ paragraphs?: number }>()

const lineWidths = ['w-full', 'w-full', 'w-11/12', 'w-3/4']
</script>

<template>
  <div role="status" aria-busy="true" class="skeleton-group">
    <span class="sr-only">正在加载正文…</span>

    <div
      v-for="p in paragraphs"
      :key="p"
      aria-hidden="true"
      class="mb-7 space-y-3"
    >
      <div
        v-for="(w, i) in lineWidths"
        :key="i"
        class="skeleton h-4"
        :class="w"
      />
    </div>
  </div>
</template>
