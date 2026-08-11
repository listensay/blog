<script setup lang="ts">
const { data: page } = await useAsyncData('about-page', () =>
  queryCollection('pages').path('/about').first(),
)

useSeoMeta({
  title: () => page.value?.title ?? '关于',
  description: () => page.value?.description ?? siteConfig.description,
})
</script>

<template>
  <div class="py-12 sm:py-16">
    <header class="border-b border-slate-200 pb-8">
      <h1 class="text-3xl font-bold tracking-tight text-slate-900">
        {{ page?.title ?? '关于' }}
      </h1>
      <p v-if="page?.description" class="mt-3 text-lg text-slate-600">
        {{ page.description }}
      </p>
    </header>

    <div v-if="page" class="prose-cn mt-10">
      <ContentRenderer :value="page" />
    </div>
    <p v-else class="py-12 text-slate-500">
      内容缺失：请检查 <code class="rounded bg-slate-100 px-1.5 py-0.5 text-sm">content/pages/about.md</code> 是否存在。
    </p>
  </div>
</template>
