<script setup lang="ts">
interface PostLike {
  path?: string
  title?: string
  description?: string
  /** `YYYY-MM-DD HH:mm`，见 app/utils/date.ts */
  date?: string
  category?: string
  tags?: string[]
}

defineProps<{ post: PostLike }>()
</script>

<template>
  <article
    class="group relative px-4 py-5 sm:px-6 sm:py-7 border-b last:border-none border-zinc-100"
  >
    <div class="flex flex-wrap items-center gap-x-2.5  gap-y-1.5 text-xs text-slate-900 sm:gap-x-3 sm:gap-y-2 sm:text-sm">
      <time v-if="post.date" :datetime="isoDateTime(post.date)">
        {{ formatDateTime(post.date) }}
      </time>
      <span v-if="post.date && (post.category || post.tags?.length)" class="text-slate-300">·</span>
      <CategoryBadge v-if="post.category" :category="post.category" class="relative z-10" />
    </div>
    <div v-if="post.tags?.length" class="flex flex-wrap gap-1.5 mt-2.5">
      <TagBadge v-for="t in post.tags" :key="t" :tag="t" class="relative z-10" />
    </div>
    <h2 class="mt-2.5 text-lg font-semibold tracking-tight text-slate-900 sm:mt-3 sm:text-xl">
      <NuxtLink :to="post.path">
        <span class="absolute inset-0" aria-hidden="true" />
        {{ post.title }}
      </NuxtLink>
    </h2>

    <p v-if="post.description" class="mt-1.5 text-sm text-slate-600 sm:mt-2 sm:text-base">
      {{ post.description }}
    </p>
  </article>
</template>
