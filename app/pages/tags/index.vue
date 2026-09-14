<script setup lang="ts">
import { taxonomyLink } from '../../utils/taxonomy'

const { locale, blogCollection, t, localPath, taxonomyLabel } = useLocale()

const { data: posts, status, error } = await useAsyncData(
  () => `tag-index-posts-${locale.value}`,
  () => queryCollection(blogCollection.value).where('draft', '=', false).select('tags').all(),
  { lazy: true },
)

const { loading } = useQueryState(status, error)

const tagCounts = computed(() => {
  const map = new Map<string, { name: string, count: number }>()
  for (const post of posts.value ?? []) {
    for (const tag of post.tags ?? []) {
      const key = taxonomySlug(tag, 'tag')
      const current = map.get(key) ?? { name: tag, count: 0 }
      current.count++
      map.set(key, current)
    }
  }
  return [...map.values()].map(item => [item.name, item.count] as [string, number]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], locale.value))
})

const skeletonWidths = ['w-24', 'w-32', 'w-20', 'w-28', 'w-36', 'w-24', 'w-28', 'w-20']

useSeo({
  title: () => t('tags'),
  description: () => t('tagsDescription', { site: siteConfig.title }),
})
</script>

<template>
  <div class="py-8 sm:py-16">
    <header class="border-b border-slate-200 pb-6 sm:pb-8">
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{{ t('tags') }}</h1>
      <div v-if="loading" class="skeleton mt-3 h-5 w-24" aria-hidden="true" />
      <p v-else class="mt-2 text-slate-600">{{ t('tagCount', { count: tagCounts.length }) }}</p>
    </header>

    <div
      v-if="loading"
      role="status"
      aria-busy="true"
      class="skeleton-group mt-8 flex flex-wrap gap-3"
    >
      <span class="sr-only">{{ t('loadingTags') }}</span>
      <div
        v-for="w in skeletonWidths"
        :key="w"
        aria-hidden="true"
        class="skeleton h-11 rounded-xl"
        :class="w"
      />
    </div>

    <ul v-else-if="tagCounts.length" class="mt-8 flex flex-wrap gap-3">
      <li v-for="([tag, count], i) in tagCounts" :key="tag" v-reveal="i">
        <NuxtLink
          :to="localPath(taxonomyLink('tags', tag))"
          class="tag-chip gap-2 rounded-xl px-4 py-2 text-sm"
          :class="tagTone(tag)"
        >
          <span class="font-medium">{{ taxonomyLabel(tag, 'tag') }}</span>
          <span class="rounded-full bg-white/70 px-2 py-0.5 text-xs">{{ count }}</span>
        </NuxtLink>
      </li>
    </ul>
    <p v-else class="py-10 text-slate-500 sm:py-12">{{ t('noTagsYet') }}</p>
  </div>
</template>
