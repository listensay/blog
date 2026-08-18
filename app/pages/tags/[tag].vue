<script setup lang="ts">
const route = useRoute()
const tag = computed(() => decodeURIComponent(String(route.params.tag)))

const { data: allPosts, status, error } = await useAsyncData(
  'tag-page-posts',
  () =>
    queryCollection('blog')
      .where('draft', '=', false)
      .order('date', 'DESC')
      .all(),
  { lazy: true },
)

const { loading } = useQueryState(status, error)

const posts = computed(() =>
  (allPosts.value ?? []).filter(p => p.tags?.includes(tag.value)),
)

useSeoMeta({
  title: () => `标签：${tag.value}`,
  description: () => `${siteConfig.title}中标签为 ${tag.value} 的文章`,
})
</script>

<template>
  <div class="py-8 sm:py-16">
    <header class="border-b border-slate-200 pb-6 sm:pb-8">
      <NuxtLink
        to="/tags"
        class="text-sm text-slate-500 transition-colors hover:text-brand-600"
      >
        ← 所有标签
      </NuxtLink>
      <h1 class="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {{ tag }}
      </h1>
      <div v-if="loading" class="skeleton mt-3 h-5 w-20" aria-hidden="true" />
      <p v-else class="mt-2 text-slate-600">{{ posts.length }} 篇文章</p>
    </header>

    <PostListSkeleton v-if="loading" :count="3" />
    <div v-else-if="posts.length">
      <PostCard
        v-for="(post, i) in posts"
        :key="post.path"
        v-reveal="i"
        :post="post"
      />
    </div>
    <p v-else class="py-10 text-slate-500 sm:py-12">
      没有找到标签为「{{ tag }}」的文章。
    </p>
  </div>
</template>
