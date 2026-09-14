<script setup lang="ts">
import { taxonomyMatches } from '../../utils/taxonomy'

const { locale, blogCollection, t, localPath, taxonomyLabel } = useLocale()

const route = useRoute()
const routeSlug = computed(() => String(route.params.category))

const { data: allPosts, status, error } = await useAsyncData(
  () => `category-${locale.value}-${routeSlug.value}`,
  () =>
    queryCollection(blogCollection.value)
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
  title: () => t('categoryTitle', { category: category.value }),
  description: () => t('categoryDescription', { site: siteConfig.title, category: category.value }),
})
</script>

<template>
  <div class="py-8 sm:py-16">
    <header class="pb-6 sm:pb-8">
      <NuxtLink
        :to="localPath('/categories')"
        class="text-sm text-slate-500 transition-colors hover:text-brand-600"
      >
        ← {{ t('allCategories') }}
      </NuxtLink>
      <h1 class="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {{ taxonomyLabel(category, 'category') }}
      </h1>
      <div v-if="loading" class="skeleton mt-3 h-5 w-20" aria-hidden="true" />
      <p v-else class="mt-2 text-slate-600">{{ t('articleCount', { count: posts?.length ?? 0 }) }}</p>
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
      {{ t('noCategoryArticles', { category }) }}
    </p>
  </div>
</template>
