<script setup lang="ts">
import { NuxtLink } from '#components'

const { data: page, status, error } = await useAsyncData(
  'links-page',
  () => queryCollection('pages').path('/links').first(),
  { lazy: true },
)

const { loading } = useQueryState(status, error)

const friends = computed(() => page.value?.friends ?? [])

const hasBody = computed(() => {
  const value = page.value?.body?.value
  return Array.isArray(value) && value.length > 0
})

const isExternal = (url: string) => /^https?:\/\//.test(url)

const initial = (name: string) => [...name][0] ?? '?'

useSeo({
  title: () => page.value?.title ?? '友情链接',
  description: () => page.value?.description ?? `${siteConfig.title}交换的友情链接`,
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
          {{ page?.title ?? '友情链接' }}
        </h1>
        <p v-if="page?.description" class="mt-3 text-lg text-slate-600">
          {{ page.description }}
        </p>
      </template>
    </header>

    <div v-if="loading" class="prose-cn mt-6 sm:mt-10">
      <ProseSkeleton :paragraphs="2" />
    </div>
    <div v-else-if="hasBody && page" class="prose-cn mt-6 sm:mt-10">
      <ContentRenderer :value="page" />
      <ul v-if="friends.length" class="mt-8 grid gap-4 sm:grid-cols-2 list-none p-0 m-0">
        <li v-for="(link, i) in friends" :key="link.url" v-reveal="i">
          <component
            :is="isExternal(link.url) ? 'a' : NuxtLink"
            v-bind="isExternal(link.url)
              ? { href: link.url, target: '_blank', rel: 'noopener noreferrer' }
              : { to: link.url }"
            class="group flex h-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
          >
            <img
              v-if="link.avatar"
              :src="link.avatar"
              :alt="`${link.name} 的头像`"
              width="48"
              height="48"
              loading="lazy"
              class="size-12 shrink-0 rounded-full object-cover"
            >
            <span
              v-else
              aria-hidden="true"
              class="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700"
            >
              {{ initial(link.name) }}
            </span>

            <span class="min-w-0">
              <span class="block truncate font-semibold text-slate-900 group-hover:text-brand-700">
                {{ link.name }}
              </span>
              <span class="mt-0.5 block truncate text-sm text-slate-500">
                {{ link.description }}
              </span>
            </span>
          </component>
        </li>
      </ul>
      <p v-else-if="!loading" class="py-10 text-slate-500 sm:py-12">
        还没有友情链接。
      </p>
    </div>
  </div>
</template>
