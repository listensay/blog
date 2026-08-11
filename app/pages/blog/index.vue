<script setup lang="ts">
const { data: posts } = await useAsyncData('all-posts', () =>
  queryCollection('blog')
    .where('draft', '=', false)
    .order('date', 'DESC')
    .all(),
)

useSeoMeta({
  title: '全部文章',
  description: `${siteConfig.title}的文章列表`,
})
</script>

<template>
  <div class="py-12 sm:py-16">
    <header class="pb-8">
      <h1 class="text-3xl font-bold tracking-tight text-slate-900">全部文章</h1>
      <p class="mt-2 text-slate-600">
        共 {{ posts?.length ?? 0 }} 篇
      </p>
    </header>

    <div v-if="posts?.length">
      <PostCard v-for="post in posts" :key="post.path" :post="post" />
    </div>
    <p v-else class="py-12 text-slate-500">还没有文章。</p>
  </div>
</template>
