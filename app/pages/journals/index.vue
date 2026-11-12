<script setup lang="ts">
const { data: entries, status, error, refresh } = await useAsyncData(
  'journals',
  () => queryCollection('journals')
    .where('draft', '=', false)
    .order('date', 'DESC')
    .select('path', 'date', 'title', 'body')
    .all(),
)
const timelineEl = ref<HTMLElement>()
useProseLightbox(timelineEl, '.prose-cn img')
useSeo({ title: () => '日记', description: () => `${siteConfig.title}的日记列表` })
</script>

<template>
  <div class="py-8 sm:py-16">
    <header class="border-b border-panel-line pb-7 sm:pb-9">
      <h1 class="text-2xl font-bold tracking-tight text-panel-text sm:text-3xl">日记</h1>
    </header>

    <div v-if="error" role="alert" class="py-12 text-panel-muted">
      <p>日记加载失败</p>
      <button class="mt-4 min-h-11 rounded-xs text-accent underline underline-offset-4 disabled:opacity-50" :disabled="status === 'pending'" @click="refresh()">刷新</button>
    </div>
    <div v-else-if="status === 'pending'" role="status" aria-busy="true" class="skeleton-group space-y-8 py-8">
      <span class="sr-only">正在加载日记</span>
      <div v-for="index in 3" :key="index" aria-hidden="true" class="relative pl-14 sm:pl-16">
        <span class="skeleton absolute left-0 top-3 size-10 rounded-full" />
        <div class="space-y-3 rounded-sm border border-panel-line bg-panel-raised p-4 sm:p-5">
          <div class="skeleton h-4 w-32" />
          <div class="skeleton h-4 w-full" />
          <div class="skeleton h-4 w-3/4" />
        </div>
      </div>
    </div>
    <div v-else-if="!entries?.length" class="py-16 text-center text-panel-muted">
      <p>暂无日记</p>
    </div>
    <template v-else>
      <p class="my-8 text-sm text-panel-muted">{{ `已记录 ${entries.length} 天` }}</p>
      <ol ref="timelineEl" class="[&.lightbox-ready_.prose-cn_img]:cursor-zoom-in" aria-label="日记列表">
        <li v-for="(entry, index) in entries" :key="entry.path" class="relative pb-6 pl-14 last:pb-0 sm:pb-8 sm:pl-16">
          <img :src="siteConfig.avatar" :alt="siteConfig.author" width="40" height="40" loading="lazy" class="absolute left-0 top-3 size-10 rounded-full bg-panel-raised object-cover" />
          <span v-if="index < entries.length - 1" class="absolute -bottom-1 left-[19.5px] top-15 w-px bg-panel-muted/35" aria-hidden="true" />
          <article :aria-labelledby="`journal-${entry.date}`" class="min-w-0 rounded-sm border border-panel-line bg-panel-raised p-4 sm:p-5">
            <h2 :id="`journal-${entry.date}`" class="mb-2">
              <NuxtLink :to="entry.path" class="group -my-2 inline-flex min-h-11 max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xs transition-colors duration-150 hover:text-accent">
                <span class="min-w-0 max-w-full break-words text-base font-semibold">{{ siteConfig.author }}</span>
                <time :datetime="entry.date" class="text-sm font-medium text-panel-muted tabular-nums transition-colors duration-150 group-hover:text-accent">{{ formatDate(entry.date) }}</time>
              </NuxtLink>
            </h2>
            <h3 v-if="entry.title !== entry.date" class="mb-3 min-w-0 break-words text-base font-semibold sm:text-lg">{{ entry.title }}</h3>
            <div class="prose-cn rounded-none bg-transparent p-0 text-base leading-[1.8] md:p-0 [&_p]:my-3 [&>div>:first-child]:mt-0 [&>div>:last-child]:mb-0">
              <ContentRenderer :value="entry" />
            </div>
          </article>
        </li>
      </ol>
    </template>
  </div>
</template>
