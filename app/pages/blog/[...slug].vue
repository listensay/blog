<script setup lang="ts">
import { IconArrowLeft, IconArrowRight } from '@tabler/icons-vue'
import ArticleStats from '~/components/ArticleStats.vue'

const { locale, blogCollection, t, localPath } = useLocale()

const route = useRoute()
const pathSegments = computed(() => Array.isArray(route.params.slug)
  ? route.params.slug.map(String)
  : [String(route.params.slug)])
const slug = computed(() => pathSegments.value.at(-1) ?? '')
const path = computed(() => localPath(`/blog/${pathSegments.value.join('/')}`))

const target = computed(() => postTarget(slug.value))

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
    let q = queryCollection(blogCollection.value).path(path.value)
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
  const notFound = createError({ statusCode: 404, message: t('articleNotFound'), fatal: true })
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
    const posts = await queryCollection(blogCollection.value)
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
const toc = computed(() => post.value?.body?.toc?.links ?? [])
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
  'inLanguage': locale.value,
  'mainEntityOfPage': { '@type': 'WebPage', '@id': `${siteConfig.url}${path.value}` },
  'image': `${siteConfig.url}${post.value?.cover || siteConfig.ogImage}`,
  'author': { '@type': 'Person', 'name': siteConfig.author, 'url': siteConfig.url },
  'publisher': { '@type': 'Person', 'name': siteConfig.author, 'url': siteConfig.url },
  ...(post.value?.category ? { articleSection: post.value.category } : {}),
  ...(post.value?.tags?.length ? { keywords: post.value.tags.join(', ') } : {}),
  'breadcrumb': {
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': t('home'), 'item': `${siteConfig.url}${localPath('/')}` },
      { '@type': 'ListItem', 'position': 2, 'name': t('articles'), 'item': `${siteConfig.url}${localPath('/blog')}` },
      { '@type': 'ListItem', 'position': 3, 'name': post.value?.title ?? '' },
    ],
  },
}))
</script>

<template>
  <article class="py-8 sm:py-16">
    <ArticleSkeleton v-if="loading" />

    <template v-else-if="post">
      <div :class="toc.length ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_13rem] lg:items-start lg:gap-8' : undefined">
        <ArticleToc v-if="toc.length" :key="post.path" :links="toc" :content="proseEl" class="lg:col-start-2 lg:row-start-1" />
        <div class="min-w-0 lg:col-start-1 lg:row-start-1">
          <div ref="proseEl" class="prose-cn shadow">
            <header
              class="flex h-64 flex-col items-center justify-center overflow-hidden rounded-2xl px-4 text-center text-white"
              :style="headerStyle"
            >
              <div class="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                <time v-if="post.date" :datetime="isoDateTime(post.date)" class="font-bold">
                  {{ formatDateTime(post.date, locale) }}
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
                >{{ t('draft') }}</span>{{ post.title }}
              </h1>
              <ArticleStats :target="target" />
            </header>
            <ContentRenderer :value="post" />
          </div>
          <PostReactions :target="target" />

          <nav
            v-if="surround?.some(Boolean)"
            v-reveal
            class="mt-5 grid gap-4 sm:grid-cols-2"
          >
            <NuxtLink
              v-if="surround?.[0]"
              :to="surround[0].path"
              class="group flex min-h-36 flex-col justify-between gap-4 rounded-2xl bg-[#eaf0ea] p-5 shadow transition-colors hover:bg-[#dee8de] focus-visible:outline-emerald-700 sm:p-6"
            >
              <span class="inline-flex items-center gap-2 text-xs font-medium text-[#4f6b56]">
                <IconArrowLeft :size="17" stroke="1.8" aria-hidden="true" class="transition-transform group-hover:-translate-x-1" />
                {{ t('previousArticle') }}
              </span>
              <p class="font-semibold leading-relaxed break-words text-slate-800">
                {{ surround[0].title }}
              </p>
            </NuxtLink>
            <NuxtLink
              v-if="surround?.[1]"
              :to="surround[1].path"
              class="group flex min-h-36 flex-col justify-between gap-4 rounded-2xl bg-[#eeebf4] p-5 shadow transition-colors hover:bg-[#e3ddee] focus-visible:outline-violet-700 sm:col-start-2 sm:p-6 sm:text-right"
            >
              <span class="inline-flex items-center gap-2 text-xs font-medium text-[#706081] sm:justify-end">
                {{ t('nextArticle') }}
                <IconArrowRight :size="17" stroke="1.8" aria-hidden="true" class="transition-transform group-hover:translate-x-1" />
              </span>
              <p class="font-semibold leading-relaxed break-words text-slate-800">
                {{ surround[1].title }}
              </p>
            </NuxtLink>
          </nav>

          <CommentSection :target="target" />
        </div>
      </div>
    </template>
  </article>
</template>
