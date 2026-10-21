<script setup lang="ts">
import { IconTag } from '@tabler/icons-vue'
import { taxonomyMatches } from '../../utils/taxonomy'

const route = useRoute()
const routeSlug = computed(() => String(route.params.tag))

const { data: allPosts, status, error } = await useAsyncData(
  () => `tag-${routeSlug.value}`,
  () =>
    queryCollection('blog')
      .where('draft', '=', false)
      .order('date', 'DESC')
      .all(),
  { lazy: true },
)

const { loading } = useQueryState(status, error)

const tag = computed(() => {
  const match = allPosts.value?.find(post => post.tags?.some(item => taxonomyMatches(item, routeSlug.value, 'tag')))
  return match?.tags?.find(item => taxonomyMatches(item, routeSlug.value, 'tag')) ?? decodeURIComponent(routeSlug.value)
})
const posts = computed(() =>
  (allPosts.value ?? []).filter(p => p.tags?.some(item => taxonomyMatches(item, routeSlug.value, 'tag'))),
)

useSeo({
  title: () => `标签：${tag.value}`,
  description: () => `${siteConfig.title}中标签为 ${tag.value} 的文章`,
})
</script>

<template>
  <div class="py-8 sm:py-16">
    <header class="pb-7 sm:pb-9">
      <NuxtLink
        :to="'/tags'"
        class="text-sm text-panel-muted transition-colors hover:text-accent"
      >
        ← 所有标签
      </NuxtLink>
      <div class="mt-4 mb-4 flex size-11 items-center justify-center rounded-[5px] bg-amber-100 text-amber-700">
        <IconTag :size="24" stroke="1.6" aria-hidden="true" />
      </div>
      <h1 class="text-2xl font-bold tracking-tight text-[#eeebf7] sm:text-3xl">
        {{ taxonomyLabel(tag, 'tag') }}
      </h1>
    </header>

    <PostListSkeleton v-if="loading" :count="3" />
    <p v-else-if="error" class="article-empty p-[40px_0] text-panel-muted text-base" role="alert">文章加载失败</p>
    <div v-else-if="posts.length" class="article-list overflow-visible [border-block:1px_solid_var(--color-panel-line)]">
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
