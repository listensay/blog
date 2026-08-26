<script setup lang="ts">
import ArticleStats from '~/components/ArticleStats.vue'

const route = useRoute()
const pathSegments = computed(() => Array.isArray(route.params.slug)
  ? route.params.slug.map(String)
  : [String(route.params.slug)])
const slug = computed(() => pathSegments.value.at(-1) ?? '')
const path = computed(() => `/blog/${pathSegments.value.join('/')}`)

const headerColors = [
  '#e11d48',
  '#a21caf',
  '#7c3aed',
  '#0369a1',
  '#0f766e',
  '#047857',
  '#b45309',
]

function colorIndex(value: string) {
  let hash = 0
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % headerColors.length
}

const headerColor = computed(() => headerColors[colorIndex(path.value)]!)

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

const headerStyle = computed(() => {
  const cover = post.value?.cover
  if (!cover) return { backgroundColor: headerColor.value }

  return {
    backgroundColor: headerColor.value,
    backgroundImage: `linear-gradient(rgb(0 0 0 / 45%), rgb(0 0 0 / 65%)), url("${cover}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }
})

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
  <article class="py-8 sm:py-16">
    <ArticleSkeleton v-if="loading" />

    <template v-else-if="post">
      <div ref="proseEl" class="prose-cn">
        <header
          class="flex h-64 flex-col items-center justify-center overflow-hidden rounded-2xl px-4 text-center text-white"
          :style="headerStyle"
        >
          <div class="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <time v-if="post.date" :datetime="isoDateTime(post.date)" class="font-bold">
              {{ formatDateTime(post.date) }}
            </time>
            <span v-if="post.date && (post.category || post.tags?.length)" class="font-bold">·</span>
            <div class="text-white">
              <CategoryBadge v-if="post.category" :category="post.category" light />
            </div>
            <span v-if="post.date && (post.category || post.tags?.length)" class="font-bold">·</span>
            <div v-if="post.tags?.length" class="flex flex-wrap gap-1.5">
              <TagBadge v-for="t in post.tags" :key="t" :tag="t" />
            </div>
          </div>
          <h1 class="mt-3 mb-0 text-2xl font-bold leading-tight tracking-tight text-white sm:mt-4 sm:text-4xl">
            <span
              v-if="post.draft"
              class="mr-2 align-middle rounded bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-700"
            >草稿</span>{{ post.title }}
          </h1>
          <ArticleStats :slug="slug" />
        </header>
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
