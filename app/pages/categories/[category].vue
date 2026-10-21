<script setup lang="ts">
import { IconCategory } from '@tabler/icons-vue'
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
const posts = computed(() => (allPosts.value ?? []).filter(post => taxonomyMatches(post.category || '未分类', routeSlug.value, 'category')))

useSeo({
  title: () => `分类：${category.value}`,
  description: () => `${siteConfig.title}中分类为 ${category.value} 的文章`,
})
</script>

<template>
  <div class="py-8 sm:py-16">
    <header class="pb-7 sm:pb-9">
      <NuxtLink
        :to="'/categories'"
        class="text-sm text-panel-muted transition-colors hover:text-accent"
      >
        ← 所有分类
      </NuxtLink>
      <div class="mt-4 mb-4 flex size-11 items-center justify-center rounded-[5px] bg-amber-100 text-amber-700">
        <IconCategory :size="24" stroke="1.6" aria-hidden="true" />
      </div>
      <h1 class="text-2xl font-bold tracking-tight text-[#eeebf7] sm:text-3xl">
        {{ taxonomyLabel(category, 'category') }}
      </h1>
    </header>

    <PostListSkeleton v-if="loading" :count="3" />
    <p v-else-if="error" class="article-empty p-[40px_0] text-panel-muted text-base" role="alert">文章加载失败</p>
    <div v-else-if="posts?.length" class="article-list overflow-visible [border-block:1px_solid_var(--color-panel-line)]">
      <PostCard
        v-for="(post, i) in posts"
        :key="post.path"
        :post="post"
        :index="i + 1"
      />
    </div>
    <p v-else class="py-10 text-panel-muted sm:py-12">
      暂无文章
    </p>
  </div>
</template>
