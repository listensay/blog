<script setup lang="ts">
import { IconTag } from '@tabler/icons-vue'
import { taxonomyLink } from '../../utils/taxonomy'

const { data: posts, status, error } = await useAsyncData(
  'tag-index-posts',
  () => queryCollection('blog').where('draft', '=', false).select('tags').all(),
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
  return [...map.values()].map(item => [item.name, item.count] as [string, number]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
})

const skeletonWidths = ['w-24', 'w-32', 'w-20', 'w-28', 'w-36', 'w-24', 'w-28', 'w-20']

useSeo({
  title: () => '标签',
  description: () => `${siteConfig.title}的全部标签`,
})
</script>

<template>
  <div class="py-8 sm:py-16">
    <header class="border-b border-panel-line pb-7 sm:pb-9">
      <div class="mb-4 flex size-11 items-center justify-center rounded-[5px] bg-amber-100 text-amber-700">
        <IconTag :size="24" stroke="1.6" aria-hidden="true" />
      </div>
      <h1 class="text-2xl font-bold tracking-tight text-[#eeebf7] sm:text-3xl">标签</h1>
    </header>

    <div
      v-if="loading"
      role="status"
      aria-busy="true"
      class="skeleton-group mt-8 flex flex-wrap gap-3 rounded-none bg-transparent"
    >
      <span class="sr-only">正在加载标签…</span>
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
          :to="taxonomyLink('tags', tag)"
          class="tag-chip inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
          :class="tagTone(tag)"
        >
          <span class="font-medium">{{ taxonomyLabel(tag, 'tag') }}</span>
          <span class="rounded-full bg-white/70 px-2 py-0.5 text-xs">{{ count }}</span>
        </NuxtLink>
      </li>
    </ul>
    <p v-else class="py-10 text-panel-muted sm:py-12">暂无标签</p>
  </div>
</template>
