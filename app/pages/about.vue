<script setup lang="ts">
const { data: page, status, error } = await useAsyncData(
  'about-page',
  () => queryCollection('pages').path('/about').first(),
  { lazy: true },
)

const { loading } = useQueryState(status, error)

useSeoMeta({
  title: () => page.value?.title ?? '关于',
  description: () => page.value?.description ?? siteConfig.description,
})
</script>

<template>
  <div class="py-12 sm:py-16">
    <header class="border-b border-slate-200 pb-8">
      <template v-if="loading">
        <div class="skeleton h-9 w-40" aria-hidden="true" />
        <div class="skeleton mt-4 h-6 w-3/5" aria-hidden="true" />
      </template>
      <template v-else>
        <h1 class="text-3xl font-bold tracking-tight text-slate-900">
          {{ page?.title ?? '关于' }}
        </h1>
        <p v-if="page?.description" class="mt-3 text-lg text-slate-600">
          {{ page.description }}
        </p>
      </template>
    </header>

    <div v-if="loading" class="prose-cn mt-10">
      <ProseSkeleton :paragraphs="3" />
    </div>
    <div v-else-if="page" class="prose-cn mt-10">
      <ContentRenderer :value="page" />
    </div>
    <p v-else class="py-12 text-slate-500">
      内容缺失：请检查 <code class="rounded bg-slate-100 px-1.5 py-0.5 text-sm">content/pages/about.md</code> 是否存在。
    </p>
  </div>
</template>
