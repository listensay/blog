<script setup lang="ts">
const route = useRoute()
const slug = String(route.params.slug)
const path = `/blog/${slug}`

const { data: post, status, error } = await useAsyncData(
  `post-${path}`,
  () => {
    let q = queryCollection('blog').path(path)
    // 草稿不能对外：列表页和评论/点赞接口都按 draft=false 过滤，详情页也得一致，
    // 否则 SSR 下猜到 URL 就能直接读到未发布的稿子。dev 下放开，方便自己预览。
    if (!import.meta.dev) q = q.where('draft', '=', false)
    return q.first()
  },
  { lazy: true },
)

const { loading } = useQueryState(status, error)

// 404 判定必须等数据真正落地。客户端是 lazy 的，setup 跑到这里时 post 还是
// undefined，直上 `if (!post.value)` 会把每一次前端跳转都判成文章不存在。
function assertFound() {
  if (post.value) return
  // 中文只写 message：h3 会对非 ASCII 的 statusMessage 发告警，将来还会清洗掉
  const notFound = createError({ statusCode: 404, message: '文章不存在', fatal: true })
  // SSR 还在 setup 里，可以直接抛；客户端此时早过了 setup，得走 showError
  if (import.meta.server) throw notFound
  showError(notFound)
}

if (import.meta.server) {
  assertFound()
}
else {
  // hydration 时数据来自 payload，status 一上来就是 success，immediate 能立刻兜住
  watch(status, s => s === 'success' && assertFound(), { immediate: true })
}

// 内置的 queryCollectionItemSurroundings 按路径字母序取邻居，slug 的字母序对读者没意义，
// 这里按发布时间取：上一篇是更早的，下一篇是更新的
const { data: surround } = await useAsyncData(
  `surround-${path}`,
  async () => {
    const posts = await queryCollection('blog')
      .where('draft', '=', false)
      .order('date', 'DESC')
      .select('path', 'title')
      .all()
    const i = posts.findIndex(p => p.path === path)
    if (i === -1) return [null, null]
    return [posts[i + 1] ?? null, posts[i - 1] ?? null]
  },
  { lazy: true },
)

// 正文里的图片点开是灯箱。容器在 v-else-if 里，前端跳转时要等骨架屏换成
// 真内容才拿得到元素，所以由 composable 监听这个 ref（见 useProseLightbox）
const proseEl = ref<HTMLElement>()
useProseLightbox(proseEl)

useSeo({
  // 取 getter 形式：lazy 之下标题要等数据回来才有
  title: () => post.value?.title,
  description: () => post.value?.description,
  // 有封面就用封面当社交卡片图（cover 的相对路径已由 image-src transformer 改写）
  image: () => post.value?.cover,
  type: 'article',
  publishedTime: () => isoDateTime(post.value?.date),
  // 草稿只有 dev 能看到，别让它意外进索引
  noindex: post.value?.draft === true,
})

// 文章页的结构化数据：BlogPosting 让搜索结果能显示作者和日期，
// BreadcrumbList 让面包屑取代结果里那串裸 URL
useJsonLd(() => ({
  '@type': 'BlogPosting',
  'headline': post.value?.title ?? '',
  'description': post.value?.description ?? '',
  'datePublished': isoDateTime(post.value?.date),
  'inLanguage': 'zh-CN',
  'mainEntityOfPage': { '@type': 'WebPage', '@id': `${siteConfig.url}${path}` },
  'image': `${siteConfig.url}${post.value?.cover || siteConfig.ogImage}`,
  'author': { '@type': 'Person', 'name': siteConfig.author, 'url': siteConfig.url },
  'publisher': { '@type': 'Person', 'name': siteConfig.author, 'url': siteConfig.url },
  ...(post.value?.category ? { articleSection: post.value.category } : {}),
  ...(post.value?.tags?.length ? { keywords: post.value.tags.join(', ') } : {}),
  'breadcrumb': {
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': '首页', 'item': `${siteConfig.url}/` },
      { '@type': 'ListItem', 'position': 2, 'name': '全部文章', 'item': `${siteConfig.url}/blog` },
      { '@type': 'ListItem', 'position': 3, 'name': post.value?.title ?? '' },
    ],
  },
}))
</script>

<template>
  <article class="py-8 sm:py-16">
    <ArticleSkeleton v-if="loading" />

    <template v-else-if="post">
      <header class="border-b border-slate-200 pb-6 sm:pb-8">
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

        <h1 class="mt-3 text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:mt-4 sm:text-4xl">
          <span
            v-if="post.draft"
            class="mr-2 align-middle rounded bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-700"
          >草稿</span>{{ post.title }}
        </h1>
      </header>

      <div ref="proseEl" class="prose-cn mt-6 sm:mt-10">
        <ContentRenderer :value="post" />
      </div>

      <PostReactions :slug="slug" />

      <nav
        v-if="surround?.some(Boolean)"
        v-reveal
        class="mt-12 grid gap-4 border-t border-slate-200 pt-6 sm:mt-16 sm:grid-cols-2 sm:pt-8"
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

      <CommentSection :slug="slug" />
    </template>
  </article>
</template>
