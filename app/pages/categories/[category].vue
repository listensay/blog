<script setup lang="ts">
import { taxonomyMatches } from '../../utils/taxonomy'

const route = useRoute()
const routeSlug = computed(() => String(route.params.category))

const { data: allPosts, status, error } = await useAsyncData(
  () => `category-${routeSlug.value}`,
  () =>
    queryCollection('blog')
      .where('draft', '=', false)
      .order('date', 'DESC')
      .all(),
  { watch: [routeSlug], lazy: true },
)

const { loading } = useQueryState(status, error)
const category = computed(() => {
  const match = allPosts.value?.find(post => post.category && taxonomyMatches(post.category, routeSlug.value, 'category'))
  return match?.category ?? decodeURIComponent(routeSlug.value)
})
const posts = computed(() => (allPosts.value ?? []).filter(post => post.category === category.value))

useSeo({
  title: () => `分类：${category.value}`,
  description: () => `${siteConfig.title}中分类为 ${category.value} 的文章`,
})
</script>

<template>
  <div class="py-8 sm:py-16">
    <header class="pb-6 sm:pb-8">
      <NuxtLink
        to="/categories"
        class="text-sm text-slate-500 transition-colors hover:text-brand-600"
      >
        ← 所有分类
      </NuxtLink>
      <h1 class="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {{ category }}
      </h1>
      <div v-if="loading" class="skeleton mt-3 h-5 w-20" aria-hidden="true" />
      <p v-else class="mt-2 text-slate-600">{{ posts?.length ?? 0 }} 篇文章</p>
    </header>

    <PostListSkeleton v-if="loading" :count="3" />
    <div v-else-if="posts?.length" class="overflow-hidden rounded-2xl bg-white shadow">
      <PostCard
        v-for="(post, i) in posts"
        :key="post.path"
        v-reveal="i"
        :post="post"
      />
    </div>
    <p v-else class="py-10 text-slate-500 sm:py-12">
      没有找到分类为「{{ category }}」的文章。
    </p>
  </div>
</template>
