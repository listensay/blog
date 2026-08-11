<script setup lang="ts">
const route = useRoute()
const category = computed(() => decodeURIComponent(String(route.params.category)))

// category 是普通字符串列，可以直接交给 SQL 过滤
const { data: posts } = await useAsyncData(
  () => `category-${category.value}`,
  () =>
    queryCollection('blog')
      .where('draft', '=', false)
      .where('category', '=', category.value)
      .order('date', 'DESC')
      .all(),
  { watch: [category] },
)

useSeoMeta({
  title: () => `分类：${category.value}`,
  description: () => `${siteConfig.title}中分类为 ${category.value} 的文章`,
})
</script>

<template>
  <div class="py-12 sm:py-16">
    <header class="pb-8">
      <NuxtLink
        to="/categories"
        class="text-sm text-slate-500 transition-colors hover:text-brand-600"
      >
        ← 所有分类
      </NuxtLink>
      <h1 class="mt-3 text-3xl font-bold tracking-tight text-slate-900">
        {{ category }}
      </h1>
      <p class="mt-2 text-slate-600">{{ posts?.length ?? 0 }} 篇文章</p>
    </header>

    <div v-if="posts?.length">
      <PostCard v-for="post in posts" :key="post.path" :post="post" />
    </div>
    <p v-else class="py-12 text-slate-500">
      没有找到分类为「{{ category }}」的文章。
    </p>
  </div>
</template>
