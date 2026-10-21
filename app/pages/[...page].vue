<script setup lang="ts">
import { IconUser } from '@tabler/icons-vue'

const route = useRoute()

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

function assertFound() {
  if (page.value) return
  const notFound = createError({ statusCode: 404, message: '页面不存在', fatal: true })
  if (import.meta.server) throw notFound
  showError(notFound)
}

if (import.meta.server) {
  assertFound()
}
else {
  watch(status, s => s === 'success' && assertFound(), { immediate: true })
}

const target = computed(() => pageTarget(path.value))

const proseEl = ref<HTMLElement>()
useProseLightbox(proseEl)

useSeo({
  title: () => page.value?.title,
  description: () => page.value?.description,
})
</script>

<template>
  <div class="py-8 sm:py-16">
    <header class="border-b border-panel-line" :class="path === '/about' ? 'pb-7 sm:pb-9' : 'pb-6 sm:pb-8'">
      <div v-if="path === '/about'" class="mb-4 flex size-11 items-center justify-center rounded-[5px] bg-amber-100 text-amber-700">
        <IconUser :size="24" stroke="1.6" aria-hidden="true" />
      </div>
      <template v-if="loading">
        <div class="skeleton h-9 w-40" aria-hidden="true" />
        <div v-if="path !== '/about'" class="skeleton mt-4 h-6 w-3/5" aria-hidden="true" />
      </template>
      <template v-else>
        <h1 class="text-2xl font-bold tracking-tight text-[#eeebf7] sm:text-3xl">
          {{ page?.title }}
        </h1>
        <p v-if="path !== '/about' && page?.description" class="mt-3 text-lg text-panel-muted">
          {{ page.description }}
        </p>
      </template>
    </header>

    <div v-if="loading" class="prose-cn mt-6 sm:mt-10">
      <ProseSkeleton :paragraphs="3" />
    </div>
    <template v-else-if="page">
      <div ref="proseEl" class="prose-cn mt-6 sm:mt-10">
        <ContentRenderer :value="page" />
      </div>
      <CommentSection v-if="page.comments" :target="target" />
    </template>
  </div>
</template>
