<script setup lang="ts">
// 固定页的通吃路由：content/pages 下的任何 .md 都由它渲染，新建页面不用写 .vue，查不到就 404。
// 静态段权重更高，想给某个页面做特殊排版就在 app/pages/ 下写一个同名 .vue
const route = useRoute()

// 内容库里的 path 不带尾斜杠，而 `/about/` 也能匹配到这个路由 —— 不归一化就会 404
const path = computed(() => {
  const raw = route.path.replace(/\/+$/, '')
  return raw || '/'
})

const { data: page, status, error } = await useAsyncData(
  () => `page-${path.value}`,
  () => queryCollection('pages').path(path.value).first(),
  { lazy: true },
)

const { loading } = useQueryState(status, error)

// 404 判定要等数据真正落地：客户端是 lazy 的，setup 跑到这里时 page 还是 undefined
function assertFound() {
  if (page.value) return
  // 中文只写 message：h3 会对非 ASCII 的 statusMessage 发告警，将来还会清洗掉
  const notFound = createError({ statusCode: 404, message: '页面不存在', fatal: true })
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

// 正文里的图片点开是灯箱，和文章页一致
const proseEl = ref<HTMLElement>()
useProseLightbox(proseEl)

useSeo({
  // 取 getter 形式：lazy 之下标题要等数据回来才有
  title: () => page.value?.title,
  description: () => page.value?.description,
})
</script>

<template>
  <div class="py-8 sm:py-16">
    <header class="border-b border-slate-200 pb-6 sm:pb-8">
      <template v-if="loading">
        <div class="skeleton h-9 w-40" aria-hidden="true" />
        <div class="skeleton mt-4 h-6 w-3/5" aria-hidden="true" />
      </template>
      <template v-else>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {{ page?.title }}
        </h1>
        <p v-if="page?.description" class="mt-3 text-lg text-slate-600">
          {{ page.description }}
        </p>
      </template>
    </header>

    <div v-if="loading" class="prose-cn mt-6 sm:mt-10">
      <ProseSkeleton :paragraphs="3" />
    </div>
    <div v-else-if="page" ref="proseEl" class="prose-cn mt-6 sm:mt-10">
      <ContentRenderer :value="page" />
    </div>
    <!-- 走不到这里：查不到内容会先被 assertFound 转成 404 -->
  </div>
</template>
