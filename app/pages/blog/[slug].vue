<script setup lang="ts">
const route = useRoute()
const path = `/blog/${route.params.slug}`

const { data: post } = await useAsyncData(`post-${path}`, () =>
  queryCollection('blog').path(path).first(),
)

if (!post.value) {
  throw createError({ statusCode: 404, statusMessage: '文章不存在', fatal: true })
}

// 内置的 queryCollectionItemSurroundings 按路径字母序取邻居，slug 的字母序对读者没意义，
// 这里按发布时间取：上一篇是更早的，下一篇是更新的
const { data: surround } = await useAsyncData(`surround-${path}`, async () => {
  const posts = await queryCollection('blog')
    .where('draft', '=', false)
    .order('date', 'DESC')
    .select('path', 'title')
    .all()
  const i = posts.findIndex(p => p.path === path)
  if (i === -1) return [null, null]
  return [posts[i + 1] ?? null, posts[i - 1] ?? null]
})

useSeoMeta({
  title: post.value.title,
  description: post.value.description,
})
</script>

<template>
  <article v-if="post" class="py-12 sm:py-16">
    <header class="border-b border-slate-200 pb-8">
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-500">
        <time v-if="post.date" :datetime="isoDate(post.date)">
          {{ formatDate(post.date) }}
        </time>
        <span v-if="post.date && (post.category || post.tags?.length)" class="text-slate-300">·</span>
        <CategoryBadge v-if="post.category" :category="post.category" />
        <div v-if="post.tags?.length" class="flex flex-wrap gap-1.5">
          <TagBadge v-for="t in post.tags" :key="t" :tag="t" />
        </div>
      </div>

      <h1 class="mt-4 text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">
        {{ post.title }}
      </h1>
    </header>

    <div class="prose-cn mt-10">
      <ContentRenderer :value="post" />
    </div>

    <nav
      v-if="surround?.some(Boolean)"
      class="mt-16 grid gap-4 border-t border-slate-200 pt-8 sm:grid-cols-2"
    >
      <NuxtLink
        v-if="surround?.[0]"
        :to="surround[0].path"
        class="group rounded-xl border border-slate-200 p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
      >
        <span class="text-xs font-medium uppercase tracking-wider text-slate-400">上一篇</span>
        <p class="mt-1 font-medium text-slate-900 group-hover:text-brand-700">
          {{ surround[0].title }}
        </p>
      </NuxtLink>
      <NuxtLink
        v-if="surround?.[1]"
        :to="surround[1].path"
        class="group rounded-xl border border-slate-200 p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40 sm:col-start-2 sm:text-right"
      >
        <span class="text-xs font-medium uppercase tracking-wider text-slate-400">下一篇</span>
        <p class="mt-1 font-medium text-slate-900 group-hover:text-brand-700">
          {{ surround[1].title }}
        </p>
      </NuxtLink>
    </nav>
  </article>
</template>
