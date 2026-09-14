<script setup lang="ts">
const { locale, blogCollection, t } = useLocale()
const { data: posts, status, error } = await useAsyncData(
  () => `all-posts-${locale.value}`,
  () =>
    queryCollection(blogCollection.value)
      .where('draft', '=', false)
      .order('date', 'DESC')
      .all(),
  { lazy: true },
)

const { loading } = useQueryState(status, error)

useSeo({
  title: () => t('articles'),
  description: () => t('articlesDescription', { site: siteConfig.title }),
})
</script>

<template>
  <div class="py-8 sm:py-16">
    <header class="pb-6 sm:pb-8">
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{{ t('articles') }}</h1>
      <div v-if="loading" class="skeleton mt-3 h-5 w-20" aria-hidden="true" />
      <p v-else class="mt-2 text-slate-600">
        {{ t('articleCount', { count: posts?.length ?? 0 }) }}
      </p>
    </header>

    <PostListSkeleton v-if="loading" :count="6" />
    <div v-else-if="posts?.length" class="overflow-hidden rounded-2xl bg-white shadow">
      <PostCard
        v-for="(post, i) in posts"
        :key="post.path"
        v-reveal="i"
        :post="post"
      />
    </div>
    <p v-else class="py-10 text-slate-500 sm:py-12">{{ t('noArticlesYet') }}</p>
  </div>
</template>
