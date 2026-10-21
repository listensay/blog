<script setup lang="ts">
import { IconArrowLeft, IconArrowRight } from '@tabler/icons-vue'

const route = useRoute()
const pathSegments = computed(() => Array.isArray(route.params.slug)
  ? route.params.slug.map(String)
  : [String(route.params.slug)])
const slug = computed(() => pathSegments.value.at(-1) ?? '')
const path = computed(() => (`/blog/${pathSegments.value.join('/')}`))

const target = computed(() => postTarget(slug.value))

const { data: post, status, error } = await useAsyncData(
  () => `post-${path.value}`,
  () => {
    let q = queryCollection('blog').path(path.value)
    if (!import.meta.dev) q = q.where('draft', '=', false)
    return q.first()
  },
  { lazy: true },
)

const { loading } = useQueryState(status, error)

function assertFound() {
  if (post.value) return
  const notFound = createError({ statusCode: 404, message: '文章不存在', fatal: true })
  if (import.meta.server) throw notFound
  showError(notFound)
}

if (import.meta.server) {
  assertFound()
}
else {
  watch(status, s => s === 'success' && assertFound(), { immediate: true })
}

const { data: surround } = await useAsyncData(
  () => `surround-${path.value}`,
  async () => {
    const posts = await queryCollection('blog')
      .where('draft', '=', false)
      .order('date', 'DESC')
      .select('path', 'title')
      .all()
    const i = posts.findIndex(p => p.path === path.value)
    if (i === -1) return [null, null]
    return [posts[i + 1] ?? null, posts[i - 1] ?? null]
  },
  { lazy: true },
)

const proseEl = ref<HTMLElement>()
useProseLightbox(proseEl)

useSeo({
  title: () => post.value?.title,
  description: () => post.value?.description,
  image: () => post.value?.cover,
  type: 'article',
  publishedTime: () => isoDateTime(post.value?.date),
  noindex: post.value?.draft === true,
})

useJsonLd(() => ({
  '@type': 'BlogPosting',
  'headline': post.value?.title ?? '',
  'description': post.value?.description ?? '',
  'datePublished': isoDateTime(post.value?.date),
  'inLanguage': 'zh-CN',
  'mainEntityOfPage': { '@type': 'WebPage', '@id': `${siteConfig.url}${path.value}` },
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
  <article class="article-page pt-1.5 pb-8 lg:pt-0">
    <ArticleSkeleton v-if="loading" />

    <template v-else-if="post">
      <div class="min-w-0">
        <header
          class="grid items-center gap-8 border-b border-panel-line pt-3 pb-8 sm:pb-10"
          :class="post.cover ? 'min-[1200px]:grid-cols-[minmax(0,1fr)_120px]' : undefined"
        >
          <div class="min-w-0">
            <div v-if="post.category || post.date" class="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-panel-muted">
              <CategoryBadge v-if="post.category" :category="post.category" class="[&]:text-accent" />
              <span v-if="post.category && post.date" aria-hidden="true">·</span>
              <time v-if="post.date" :datetime="isoDateTime(post.date)" class="tabular-nums">{{ formatDateTime(post.date) }}</time>
            </div>
            <h1 class="text-[28px] font-bold leading-[1.35] tracking-tight wrap-break-word text-panel-text sm:text-[32px]">
              <span v-if="post.draft" class="mr-2 align-middle rounded-xs bg-accent/10 px-2 py-1 text-xs font-medium tracking-normal text-accent">草稿</span>{{ post.title }}
            </h1>
          </div>
          <img
            v-if="post.cover"
            :src="post.cover"
            alt=""
            width="120"
            height="120"
            class="hidden aspect-square w-full rounded-sm object-cover min-[1200px]:block"
          >
        </header>

        <div ref="proseEl" class="mt-8 sm:mt-10 [&.lightbox-ready_img]:cursor-zoom-in">
          <ArticleBody :value="post" />
        </div>

        <PostReactions :key="target.id" :target="target" variant="inline" show-comments>
          <div v-if="post.tags?.length" class="mb-5 flex flex-wrap gap-2" aria-label="文章标签">
            <TagBadge v-for="tag in post.tags" :key="tag" :tag="tag" variant="cover" />
          </div>
        </PostReactions>

        <nav
          v-if="surround?.some(Boolean)"
          v-reveal
          aria-label="相邻文章"
          class="mt-8 grid gap-4 sm:grid-cols-2"
        >
          <NuxtLink
            v-if="surround?.[0]"
            :to="surround[0].path"
            class="group flex min-h-28 flex-col justify-between gap-4 rounded-sm border border-panel-line bg-panel-raised p-5 transition-colors hover:border-accent/40 hover:bg-white/5 sm:p-6"
          >
            <span class="inline-flex items-center gap-2 text-xs font-medium text-panel-muted group-hover:text-accent">
              <IconArrowLeft :size="17" stroke="1.8" aria-hidden="true" />
              上一篇
            </span>
            <p class="font-semibold leading-relaxed wrap-break-word text-panel-text">{{ surround[0].title }}</p>
          </NuxtLink>
          <NuxtLink
            v-if="surround?.[1]"
            :to="surround[1].path"
            class="group flex min-h-28 flex-col justify-between gap-4 rounded-sm border border-panel-line bg-panel-raised p-5 transition-colors hover:border-accent/40 hover:bg-white/5 sm:col-start-2 sm:p-6 sm:text-right"
          >
            <span class="inline-flex items-center gap-2 text-xs font-medium text-panel-muted group-hover:text-accent sm:justify-end">
              下一篇
              <IconArrowRight :size="17" stroke="1.8" aria-hidden="true" />
            </span>
            <p class="font-semibold leading-relaxed wrap-break-word text-panel-text">{{ surround[1].title }}</p>
          </NuxtLink>
        </nav>

        <CommentSection :key="target.id" :target="target" variant="inline" collapsible />
      </div>
    </template>
  </article>
</template>
