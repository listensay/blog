<script setup lang="ts">
import { IconLink } from '@tabler/icons-vue'
import { NuxtLink } from '#components'

const { data: page, status, error } = await useAsyncData(
  'links-page',
  () => queryCollection('pages').path(('/links')).first(),
  { lazy: true },
)

const { loading } = useQueryState(status, error)

const friends = computed(() => page.value?.friends ?? [])

const target = pageTarget('/links')

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
    <header class="border-b border-panel-line pb-7 sm:pb-9">
      <div class="mb-4 flex size-11 items-center justify-center rounded-[5px] bg-amber-100 text-amber-700">
        <IconLink :size="24" stroke="1.6" aria-hidden="true" />
      </div>
      <template v-if="loading">
        <div class="skeleton h-9 w-40" aria-hidden="true" />
      </template>
      <template v-else>
        <h1 class="text-2xl font-bold tracking-tight text-[#eeebf7] sm:text-3xl">
          {{ page?.title ?? '友情链接' }}
        </h1>
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
            class="group flex h-full items-center gap-4 rounded-xl border border-panel-line bg-panel-raised p-4 transition-colors hover:border-brand-300 hover:bg-[#29243b]"
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
              class="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#312744] text-lg font-semibold text-[#c7b7ed]"
            >
              {{ initial(link.name) }}
            </span>

            <span class="min-w-0">
              <span class="block truncate font-semibold text-[#eeebf7] group-hover:text-accent">
                {{ link.name }}
              </span>
              <span class="mt-0.5 block truncate text-sm text-panel-muted">
                {{ link.description }}
              </span>
            </span>
          </component>
        </li>
      </ul>
      <p v-else-if="!loading" class="py-10 text-panel-muted sm:py-12">
        暂无友情链接
      </p>
    </div>

    <template v-if="!loading && page">
      <CommentSection v-if="page.comments" :target="target" />
    </template>
  </div>
</template>
