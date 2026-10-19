<script setup lang="ts">
import { IconArrowUpRight, IconBrandGithub, IconCode } from '@tabler/icons-vue'
import type { PublishedProject } from '~/types/project'

const { data: projects, error, refresh, status } = await useAsyncData('projects', () => $fetch<PublishedProject[]>('/api/projects'))
const selectedTag = ref('')
const tags = computed(() => [...new Set((projects.value ?? []).flatMap(project => project.tags))])
const filtered = computed(() => (projects.value ?? []).filter(project => !selectedTag.value || project.tags.includes(selectedTag.value)))
const titleOf = (project: PublishedProject) => project.title
const descriptionOf = (project: PublishedProject) => project.description
const external = (url: string) => /^https?:\/\//i.test(url)

useSeo({ title: () => '作品', description: () => `${siteConfig.title}的作品列表` })
</script>

<template>
  <div class="py-8 sm:py-16">
    <header class="border-b border-slate-200 pb-6 sm:pb-8">
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">作品</h1>
    </header>

    <div v-if="error" class="py-12 text-slate-500" role="alert">
      <p>作品加载失败</p>
      <button class="mt-4 text-brand-700 underline" :disabled="status === 'pending'" @click="refresh()">刷新</button>
    </div>
    <template v-else>
      <div v-if="tags.length" class="mt-8 flex flex-wrap gap-2" aria-label="技术标签" role="group">
        <button
          v-for="tag in ['', ...tags]" :key="tag" type="button" :aria-pressed="selectedTag === tag"
          class="rounded-full border px-3.5 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          :class="selectedTag === tag ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700'"
          @click="selectedTag = tag"
        >{{ tag || '全部作品' }}</button>
      </div>

      <div v-if="!projects?.length" class="rounded-xl border border-dashed border-slate-200 px-6 py-16 text-center mt-10">
        <IconCode class="mx-auto size-10 text-slate-300" aria-hidden="true" />
        <p class="mt-4 text-slate-500">暂无作品</p>
      </div>
      <template v-else>
        <p class="mt-6 text-sm text-slate-500" aria-live="polite">{{ `共 ${filtered.length} 个作品` }}</p>
        <ul class="mt-5 grid gap-6 sm:grid-cols-2">
          <li v-for="project in filtered" :key="project.id" class="min-w-0">
            <article class="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow hover:shadow-md">
              <div class="flex aspect-video items-center justify-center overflow-hidden border-b border-slate-100 bg-slate-50">
                <img v-if="project.cover" :src="project.cover" :alt="titleOf(project)" width="640" height="360" loading="lazy" class="size-full object-cover" />
                <IconCode v-else class="size-14 text-slate-300" aria-hidden="true" />
              </div>
              <div class="flex flex-1 flex-col p-5 sm:p-6">
                <h2 class="break-words text-lg font-semibold text-slate-900">{{ titleOf(project) }}</h2>
                <p v-if="descriptionOf(project)" class="mt-2 whitespace-pre-line break-words text-sm leading-7 text-slate-600">{{ descriptionOf(project) }}</p>
                <ul v-if="project.tags.length" class="mt-4 flex flex-wrap gap-2" aria-label="技术标签">
                  <li v-for="tag in project.tags" :key="tag" class="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">{{ tag }}</li>
                </ul>
                <div v-if="project.demoUrl || project.repoUrl" class="mt-auto flex flex-wrap gap-5 pt-6">
                  <a v-if="project.demoUrl" :href="project.demoUrl" :target="external(project.demoUrl) ? '_blank' : undefined" :rel="external(project.demoUrl) ? 'noopener noreferrer' : undefined" class="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline" :aria-label="`查看演示 · ${titleOf(project)}`">
                    查看演示<IconArrowUpRight class="size-4" aria-hidden="true" />
                  </a>
                  <a v-if="project.repoUrl" :href="project.repoUrl" :target="external(project.repoUrl) ? '_blank' : undefined" :rel="external(project.repoUrl) ? 'noopener noreferrer' : undefined" class="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-brand-700 hover:underline" :aria-label="`查看源码 · ${titleOf(project)}`">
                    <IconBrandGithub class="size-4" aria-hidden="true" />查看源码
                  </a>
                </div>
              </div>
            </article>
          </li>
        </ul>
      </template>
    </template>
  </div>
</template>
