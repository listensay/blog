<script setup lang="ts">
const { data: posts } = await useAsyncData('category-index-posts', () =>
  queryCollection('blog')
    .where('draft', '=', false)
    .select('category', 'title', 'path', 'date')
    .order('date', 'DESC')
    .all(),
)

// 按分类聚合，并记住每个分类下最新的一篇
const categories = computed(() => {
  const map = new Map<string, { count: number, latest?: string }>()
  for (const post of posts.value ?? []) {
    const key = post.category || '未分类'
    const cur = map.get(key) ?? { count: 0 }
    cur.count += 1
    // posts 已按日期倒序，第一次遇到的即为最新
    cur.latest ??= post.title
    map.set(key, cur)
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))
})

useSeoMeta({
  title: '分类',
  description: `${siteConfig.title}的文章分类`,
})
</script>

<template>
  <div class="py-12 sm:py-16">
    <header class="border-b border-slate-200 pb-8">
      <h1 class="text-3xl font-bold tracking-tight text-slate-900">分类</h1>
      <p class="mt-2 text-slate-600">
        共 {{ categories.length }} 个分类、{{ posts?.length ?? 0 }} 篇文章
      </p>
    </header>

    <ul v-if="categories.length" class="mt-8 grid gap-4 sm:grid-cols-2">
      <li v-for="c in categories" :key="c.name">
        <NuxtLink
          :to="`/categories/${encodeURIComponent(c.name)}`"
          class="group flex h-full flex-col rounded-xl border border-slate-200 p-5 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
        >
          <div class="flex items-center justify-between gap-3">
            <span class="text-lg font-semibold text-slate-900 group-hover:text-brand-700">
              {{ c.name }}
            </span>
            <span class="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
              {{ c.count }} 篇
            </span>
          </div>
          <p v-if="c.latest" class="mt-2 truncate text-sm text-slate-500">
            最新：{{ c.latest }}
          </p>
        </NuxtLink>
      </li>
    </ul>
    <p v-else class="py-12 text-slate-500">还没有分类。</p>
  </div>
</template>
