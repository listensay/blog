<script setup lang="ts">
import { taxonomyLink } from '../../utils/taxonomy'

const { locale, blogCollection, t, localPath, taxonomyLabel } = useLocale()

const { data: posts, status, error } = await useAsyncData(
  () => `category-index-posts-${locale.value}`,
  () =>
    queryCollection(blogCollection.value)
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
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, locale.value))
})

useSeo({
  title: () => t('categories'),
  description: () => t('categoriesDescription', { site: siteConfig.title }),
})
</script>

<template>
  <div class="py-8 sm:py-16">
    <header class="border-b border-slate-200 pb-6 sm:pb-8">
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{{ t('categories') }}</h1>
      <div v-if="loading" class="skeleton mt-3 h-5 w-48" aria-hidden="true" />
      <p v-else class="mt-2 text-slate-600">
        {{ t('categoryCount', { count: categories.length }) }} · {{ t('articleCount', { count: posts?.length ?? 0 }) }}
      </p>
    </header>

    <div
      v-if="loading"
      role="status"
      aria-busy="true"
      class="skeleton-group mt-8 grid gap-4 sm:grid-cols-2"
    >
      <span class="sr-only">{{ t('loadingCategories') }}</span>
      <div
        v-for="i in 4"
        :key="i"
        aria-hidden="true"
        class="rounded-xl border border-slate-200 bg-white p-5"
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
          :to="localPath(taxonomyLink('categories', c.name))"
          class="group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
        >
          <div class="flex items-center justify-between gap-3">
            <span class="text-lg font-semibold text-slate-900 group-hover:text-brand-700">
              {{ taxonomyLabel(c.name, 'category') }}
            </span>
            <span class="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
              {{ t('articleCount', { count: c.count }) }}
            </span>
          </div>
          <p v-if="c.latest" class="mt-2 truncate text-sm text-slate-500">
            {{ t('latest') }}{{ c.latest }}
          </p>
        </NuxtLink>
      </li>
    </ul>
    <p v-else class="py-10 text-slate-500 sm:py-12">{{ t('noCategoriesYet') }}</p>
  </div>
</template>
