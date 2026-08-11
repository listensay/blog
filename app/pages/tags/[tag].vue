<script setup lang="ts">
const route = useRoute()
const tag = computed(() => decodeURIComponent(String(route.params.tag)))

const { data: allPosts } = await useAsyncData('tag-page-posts', () =>
  queryCollection('blog')
    .where('draft', '=', false)
    .order('date', 'DESC')
    .all(),
)

const posts = computed(() =>
  (allPosts.value ?? []).filter(p => p.tags?.includes(tag.value)),
)

useSeoMeta({
  title: () => `标签：${tag.value}`,
  description: () => `${siteConfig.title}中标签为 ${tag.value} 的文章`,
})
</script>

<template>
  <div class="py-12 sm:py-16">
    <header class="border-b border-slate-200 pb-8">
      <NuxtLink
        to="/tags"
        class="text-sm text-slate-500 transition-colors hover:text-brand-600"
      >
        ← 所有标签
      </NuxtLink>
      <h1 class="mt-3 text-3xl font-bold tracking-tight text-slate-900">
        {{ tag }}
      </h1>
      <p class="mt-2 text-slate-600">{{ posts.length }} 篇文章</p>
    </header>

    <div v-if="posts.length">
      <PostCard v-for="post in posts" :key="post.path" :post="post" />
    </div>
    <p v-else class="py-12 text-slate-500">
      没有找到标签为「{{ tag }}」的文章。
    </p>
  </div>
</template>
