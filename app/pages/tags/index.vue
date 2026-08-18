<script setup lang="ts">
const { data: posts, status, error } = await useAsyncData(
  'tag-index-posts',
  () => queryCollection('blog').where('draft', '=', false).select('tags').all(),
  { lazy: true },
)

const { loading } = useQueryState(status, error)

// tags 在数据库里是 JSON 字段，没法用 SQL 聚合，取回来在 JS 里统计
const tagCounts = computed(() => {
  const map = new Map<string, number>()
  for (const post of posts.value ?? []) {
    for (const tag of post.tags ?? []) {
      map.set(tag, (map.get(tag) ?? 0) + 1)
    }
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
})

// 骨架屏用长短不一的宽度，才像一堆标签而不是一排格子
const skeletonWidths = ['w-24', 'w-32', 'w-20', 'w-28', 'w-36', 'w-24', 'w-28', 'w-20']

useSeoMeta({
  title: '标签',
  description: `${siteConfig.title}的全部标签`,
})
</script>

<template>
  <div class="py-12 sm:py-16">
    <header class="border-b border-slate-200 pb-8">
      <h1 class="text-3xl font-bold tracking-tight text-slate-900">标签</h1>
      <div v-if="loading" class="skeleton mt-3 h-5 w-24" aria-hidden="true" />
      <p v-else class="mt-2 text-slate-600">共 {{ tagCounts.length }} 个</p>
    </header>

    <div
      v-if="loading"
      role="status"
      aria-busy="true"
      class="skeleton-group mt-8 flex flex-wrap gap-3"
    >
      <span class="sr-only">正在加载标签…</span>
      <div
        v-for="w in skeletonWidths"
        :key="w"
        aria-hidden="true"
        class="skeleton h-11 rounded-xl"
        :class="w"
      />
    </div>

    <ul v-else-if="tagCounts.length" class="mt-8 flex flex-wrap gap-3">
      <li v-for="([tag, count], i) in tagCounts" :key="tag" v-reveal="i">
        <NuxtLink
          :to="`/tags/${encodeURIComponent(tag)}`"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
        >
          <span class="font-medium text-slate-900">{{ tag }}</span>
          <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{{ count }}</span>
        </NuxtLink>
      </li>
    </ul>
    <p v-else class="py-12 text-slate-500">还没有标签。</p>
  </div>
</template>
