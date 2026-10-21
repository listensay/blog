<script setup lang="ts">
import { IconCategory } from '@tabler/icons-vue'
import { taxonomyLink } from '../../utils/taxonomy'

const { data: posts, status, error } = await useAsyncData(
  'category-index-posts',
  () =>
    queryCollection('blog')
      .where('draft', '=', false)
      .select('category', 'title', 'path', 'date')
      .order('date', 'DESC')
      .all(),
  { lazy: true },
)

const { loading } = useQueryState(status, error)

const categories = computed(() => {
  const map = new Map<string, { name: string, count: number, latest?: string }>()
  for (const post of posts.value ?? []) {
    const name = post.category || '未分类'
    const key = taxonomySlug(name, 'category')
    const cur = map.get(key) ?? { name, count: 0 }
    cur.count += 1
    cur.latest ??= post.title
    map.set(key, cur)
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))
})

useSeo({
  title: () => '分类',
  description: () => `${siteConfig.title}的文章分类`,
})
</script>

<template>
  <div class="py-8 sm:py-16">
    <header class="border-b border-panel-line pb-7 sm:pb-9">
      <div class="mb-4 flex size-11 items-center justify-center rounded-[5px] bg-amber-100 text-amber-700">
        <IconCategory :size="24" stroke="1.6" aria-hidden="true" />
      </div>
      <h1 class="text-2xl font-bold tracking-tight text-[#eeebf7] sm:text-3xl">分类</h1>
    </header>

    <div
      v-if="loading"
      role="status"
      aria-busy="true"
      class="skeleton-group mt-8 grid gap-4 sm:grid-cols-2 rounded-none bg-transparent"
    >
      <span class="sr-only">正在加载分类…</span>
      <div
        v-for="i in 4"
        :key="i"
        aria-hidden="true"
        class="rounded-xl border border-panel-line bg-panel-raised p-5"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="skeleton h-6 w-28" />
          <div class="skeleton h-5 w-12 rounded-full" />
        </div>
        <div class="skeleton mt-3 h-4 w-3/4" />
      </div>
    </div>

    <ul v-else-if="categories.length" class="mt-8 grid gap-4 sm:grid-cols-2">
      <li v-for="(c, i) in categories" :key="c.name" v-reveal="i">
        <NuxtLink
          :to="taxonomyLink('categories', c.name)"
          class="group flex h-full flex-col rounded-xl border border-panel-line bg-panel-raised p-5 transition-colors hover:border-brand-300 hover:bg-[#29243b]"
        >
          <div class="flex items-center justify-between gap-3">
            <span class="text-lg font-semibold text-[#eeebf7] group-hover:text-accent">
              {{ taxonomyLabel(c.name, 'category') }}
            </span>
            <span class="shrink-0 rounded-full bg-[#202033] px-2.5 py-0.5 text-xs text-panel-muted">
              {{ `${c.count} 篇文章` }}
            </span>
          </div>
          <p v-if="c.latest" class="mt-2 truncate text-sm text-panel-muted">
            最新：{{ c.latest }}
          </p>
        </NuxtLink>
      </li>
    </ul>
    <p v-else class="py-10 text-panel-muted sm:py-12">暂无分类</p>
  </div>
</template>
