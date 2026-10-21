<script setup lang="ts">
import { IconArticle } from '@tabler/icons-vue'

const { data: posts, status, error } = await useAsyncData(
  'all-posts',
  () =>
    queryCollection('blog')
      .where('draft', '=', false)
      .order('date', 'DESC')
      .all(),
  { lazy: true },
)

const { loading } = useQueryState(status, error)

useSeo({
  title: () => '全部文章',
  description: () => `${siteConfig.title}的文章列表`,
})
</script>

<template>
  <div class="py-8 sm:py-16">
    <header class="pb-7 sm:pb-9">
      <div class="mb-4 flex size-11 items-center justify-center rounded-[5px] bg-amber-100 text-amber-700">
        <IconArticle :size="24" stroke="1.6" aria-hidden="true" />
      </div>
      <h1 class="text-2xl font-bold tracking-tight text-[#eeebf7] sm:text-3xl">全部文章</h1>
    </header>

    <PostListSkeleton v-if="loading" :count="6" />
    <p v-else-if="error" class="article-empty p-[40px_0] text-panel-muted text-base" role="alert">文章加载失败</p>
    <div v-else-if="posts?.length" class="article-list overflow-visible [border-block:1px_solid_var(--color-panel-line)]">
      <div class="
          article-columns grid gap-[12px] px-4 py-3 [border-bottom:1px_solid_var(--color-panel-line)] text-[#9590ad]
          grid-cols-[26px_minmax(0,_1fr)_96px_28px] text-xs max-[1200px]:gap-[9px]
          max-[1200px]:grid-cols-[18px_minmax(0,_1fr)_88px_25px] max-lg:gap-[12px]
          max-lg:grid-cols-[24px_minmax(0,_1fr)_88px_28px] max-md:hidden [&>:nth-child(2)]:pl-[92px]
          max-[1200px]:[&>:nth-child(2)]:pl-[73px] max-lg:[&>:nth-child(2)]:pl-[76px]
        " aria-hidden="true"><span>#</span><span>文章</span><span>发布日期</span><span /></div>
      <PostCard
        v-for="(post, i) in posts"
        :key="post.path"
        :post="post"
        :index="i + 1"
      />
    </div>
    <p v-else class="py-10 text-panel-muted sm:py-12">暂无文章</p>
  </div>
</template>
