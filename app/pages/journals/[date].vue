<script setup lang="ts">
import { IconArrowLeft, IconArrowRight } from '@tabler/icons-vue'

const route = useRoute()
const entryPath = computed(() => (`/journals/${String(route.params.date)}`))
const { data: entry, error } = await useAsyncData(
  () => `journal-${entryPath.value}`,
  () => queryCollection('journals').path(entryPath.value).where('draft', '=', false).first(),
)
if (error.value) throw createError({ statusCode: 500, message: '日记加载失败，请稍后重试', fatal: true })
if (!entry.value) throw createError({ statusCode: 404, message: '日记不存在', fatal: true })
const { data: adjacent } = await useAsyncData(
  () => `journal-neighbors-${entryPath.value}`,
  async () => {
    const entries = await queryCollection('journals').where('draft', '=', false)
      .order('date', 'DESC').select('path', 'date', 'title').all()
    const index = entries.findIndex(item => item.path === entryPath.value)
    return { older: index < 0 ? null : entries[index + 1], newer: index < 0 ? null : entries[index - 1] }
  },
)
const proseEl = ref<HTMLElement>()
useProseLightbox(proseEl)
useSeo({
  title: () => entry.value?.title === entry.value?.date ? `${formatDate(entry.value?.date)} · 日记` : entry.value?.title,
  description: () => entry.value?.description,
  image: () => entry.value?.cover,
  type: 'article',
  publishedTime: () => isoDateTime(entry.value?.date),
})
useJsonLd(() => ({
  '@type': 'BlogPosting',
  headline: entry.value?.title ?? '',
  description: entry.value?.description ?? '',
  datePublished: isoDateTime(entry.value?.date),
  inLanguage: 'zh-CN',
  mainEntityOfPage: { '@type': 'WebPage', '@id': `${siteConfig.url}${entryPath.value}` },
  author: { '@type': 'Person', name: siteConfig.author, url: siteConfig.url },
}))
</script>

<template>
  <article v-if="entry" class="mx-auto max-w-3xl py-8 sm:py-16">
    <NuxtLink :to="'/journals'" class="mb-7 inline-flex items-center gap-2 text-sm text-panel-muted hover:text-amber-700">
      <IconArrowLeft :size="17" aria-hidden="true" />返回日记
    </NuxtLink>
    <header class="border-b border-panel-line pb-8">
      <time :datetime="entry.date" class="text-sm font-medium text-amber-700">{{ formatDate(entry.date) }}</time>
      <h1 class="mt-3 break-words text-2xl font-bold tracking-tight text-[#eeebf7] sm:text-3xl">{{ entry.title === entry.date ? '日记' : entry.title }}</h1>
      <p v-if="entry.description" class="mt-4 whitespace-pre-line text-base leading-8 text-panel-muted">{{ entry.description }}</p>
      <ul v-if="entry.tags?.length" class="mt-5 flex flex-wrap gap-2">
        <li v-for="tag in entry.tags" :key="tag" class="rounded-md bg-amber-50 px-2.5 py-1 text-xs text-amber-800">{{ tag }}</li>
      </ul>
    </header>
    <img v-if="entry.cover" :src="entry.cover" :alt="entry.title" width="960" height="480" class="mt-8 max-h-96 w-full rounded-[5px] object-cover" />
    <div ref="proseEl" class="prose-cn mt-8 sm:mt-10">
      <ContentRenderer :value="entry" />
    </div>
    <nav v-if="adjacent?.older || adjacent?.newer" class="mt-12 grid grid-cols-2 gap-5 border-t border-panel-line pt-7" aria-label="浏览相邻日记">
      <NuxtLink v-if="adjacent.older" :to="adjacent.older.path" class="group col-start-1 text-sm text-panel-muted hover:text-amber-700">
        <span class="flex items-center gap-2"><IconArrowLeft :size="16" aria-hidden="true" />上一篇日记</span>
        <span class="mt-2 block font-medium text-[#eeebf7]">{{ formatDate(adjacent.older.date) }}</span>
      </NuxtLink>
      <NuxtLink v-if="adjacent.newer" :to="adjacent.newer.path" class="col-start-2 text-right text-sm text-panel-muted hover:text-amber-700">
        <span class="flex items-center justify-end gap-2">下一篇日记<IconArrowRight :size="16" aria-hidden="true" /></span>
        <span class="mt-2 block font-medium text-[#eeebf7]">{{ formatDate(adjacent.newer.date) }}</span>
      </NuxtLink>
    </nav>
  </article>
</template>
