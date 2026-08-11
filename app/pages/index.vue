<script setup lang="ts">
const { data: posts } = await useAsyncData('home-posts', () =>
  queryCollection('blog')
    .where('draft', '=', false)
    .order('date', 'DESC')
    .limit(5)
    .all(),
)

useSeoMeta({
  title: siteConfig.title,
  description: siteConfig.description,
})
</script>

<template>
  <div>
    <section class="mt-4 px-6 py-16 sm:py-20 flex items-center">
      <div class="mr-4">
        <img src="@/assets/images/avatar.jpg" class="w-32 rounded-full border border-amber-50" alt="user avatar">
      </div>
      <div>
        <h1 class="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          {{ siteConfig.author }}
        </h1>
        <p class="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
          {{ siteConfig.description }}
        </p>
      </div>
    </section>

    <section class="py-4">
      <div v-if="posts?.length">
        <PostCard v-for="post in posts" :key="post.path" :post="post" />
      </div>
      <p v-else class="py-12 text-slate-500">
        还没有文章。在 <code class="rounded bg-slate-100 px-1.5 py-0.5 text-sm">content/blog/</code> 里新建一个 Markdown 文件就会出现在这里。
      </p>
    </section>
  </div>
</template>
