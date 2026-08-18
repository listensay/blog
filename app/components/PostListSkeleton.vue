<script setup lang="ts">
/**
 * 文章卡片的骨架屏，几何形状对着 PostCard 抄：
 * 元信息行 → 标题 → 摘要两行。撑住相近的高度，数据到位时页面不会往下跳。
 */
const { count = 5 } = defineProps<{ count?: number }>()

// 末行给点长短变化，整列一样宽会很假
const tailWidths = ['w-4/5', 'w-2/3', 'w-3/4', 'w-1/2', 'w-5/6']
</script>

<template>
  <div role="status" aria-busy="true" class="skeleton-group">
    <span class="sr-only">正在加载文章列表…</span>

    <div
      v-for="i in count"
      :key="i"
      aria-hidden="true"
      class="mb-4 rounded-xl border border-slate-200 bg-white p-4 py-8"
    >
      <div class="flex items-center gap-3">
        <div class="skeleton h-4 w-24" />
        <div class="skeleton h-4 w-16" />
      </div>
      <div class="skeleton mt-4 h-6 w-3/5" />
      <div class="skeleton mt-3 h-4 w-full" />
      <div class="skeleton mt-2 h-4" :class="tailWidths[(i - 1) % tailWidths.length]" />
    </div>
  </div>
</template>
