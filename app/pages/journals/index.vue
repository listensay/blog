<script setup lang="ts">
import { IconArrowUpRight, IconBook, IconCalendar } from '@tabler/icons-vue'

const selectedMonth = ref('')
const { data: entries, status, error, refresh } = await useAsyncData(
  'journals',
  () => queryCollection('journals')
    .where('draft', '=', false)
    .order('date', 'DESC')
    .select('path', 'date', 'title', 'description', 'tags', 'cover')
    .all(),
)
const months = computed(() => [...new Set((entries.value ?? []).map(entry => entry.date.slice(0, 7)))])
const groups = computed(() => months.value
  .filter(month => !selectedMonth.value || selectedMonth.value === month)
  .map(month => ({ month, entries: (entries.value ?? []).filter(entry => entry.date.startsWith(month)) })))
const monthLabel = (month: string) => new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric', month: 'long', timeZone: 'UTC',
}).format(new Date(`${month}-01T00:00:00Z`))
useSeo({ title: () => '日记', description: () => `${siteConfig.title}的日记列表` })
</script>

<template>
  <div class="py-8 sm:py-16">
    <header class="border-b border-panel-line pb-7 sm:pb-9">
      <div class="mb-4 flex size-11 items-center justify-center rounded-[5px] bg-amber-100 text-amber-700">
        <IconBook :size="24" stroke="1.6" aria-hidden="true" />
      </div>
      <h1 class="text-2xl font-bold tracking-tight text-[#eeebf7] sm:text-3xl">日记</h1>
    </header>

    <div v-if="error" role="alert" class="py-12 text-panel-muted">
      <p>日记加载失败</p>
      <button class="mt-4 text-[#c7b7ed] underline" :disabled="status === 'pending'" @click="refresh()">刷新</button>
    </div>
    <PostListSkeleton v-else-if="status === 'pending'" :count="3" class="mt-8" />
    <div v-else-if="!entries?.length" class="mt-10 rounded-[5px] border border-dashed border-panel-line bg-panel-raised px-6 py-20 text-center">
      <IconCalendar class="mx-auto size-10 text-slate-300" stroke="1.4" aria-hidden="true" />
      <p class="mt-5 text-panel-muted">暂无日记</p>
    </div>
    <template v-else>
      <div class="my-8 flex flex-wrap items-center justify-between gap-4">
        <p class="text-sm text-panel-muted">{{ `已记录 ${entries.length} 天` }}</p>
        <label class="flex items-center gap-3 text-sm text-panel-muted">
          按月查看
          <select v-model="selectedMonth" class="rounded-lg border border-panel-line bg-panel-raised px-3 py-2 focus:outline-brand-500">
            <option value="">全部月份</option>
            <option v-for="month in months" :key="month" :value="month">{{ monthLabel(month) }}</option>
          </select>
        </label>
      </div>
      <section v-for="group in groups" :key="group.month" class="mb-10 sm:mb-12" :aria-label="monthLabel(group.month)">
        <h2 class="mb-5 text-lg font-semibold text-[#eeebf7]">{{ monthLabel(group.month) }}</h2>
        <ol class="ml-3 space-y-5 border-l border-amber-200 pl-6 sm:pl-8">
          <li v-for="entry in group.entries" :key="entry.path" class="relative">
            <span class="absolute -left-[31px] top-7 size-3 rounded-full border-2 border-white bg-amber-500 ring-4 ring-slate-50 sm:-left-[39px]" aria-hidden="true" />
            <NuxtLink :to="entry.path" class="group block overflow-hidden rounded-[5px] border border-panel-line bg-panel-raised transition-colors hover:border-amber-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-500">
              <article class="p-5 sm:p-7">
                <div class="flex items-center justify-between gap-4">
                  <time :datetime="entry.date" class="text-sm font-medium text-amber-700">{{ formatDate(entry.date) }}</time>
                  <IconArrowUpRight class="size-4 shrink-0 text-panel-muted group-hover:text-amber-700" aria-hidden="true" />
                </div>
                <h3 v-if="entry.title !== entry.date" class="mt-3 break-words text-lg font-semibold text-[#eeebf7]">{{ entry.title }}</h3>
                <p v-if="entry.description" class="mt-3 line-clamp-3 whitespace-pre-line break-words text-sm leading-7 text-panel-muted">{{ entry.description }}</p>
                <img v-if="entry.cover" :src="entry.cover" alt="" width="800" height="360" loading="lazy" class="mt-5 max-h-60 w-full rounded-xl object-cover" />
                <ul v-if="entry.tags?.length" class="mt-4 flex flex-wrap gap-2">
                  <li v-for="tag in entry.tags" :key="tag" class="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">{{ tag }}</li>
                </ul>
              </article>
            </NuxtLink>
          </li>
        </ol>
      </section>
    </template>
  </div>
</template>
