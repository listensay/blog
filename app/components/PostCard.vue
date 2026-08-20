<script setup lang="ts">
interface PostLike {
  path?: string
  title?: string
  description?: string
  date?: string | Date
  category?: string
  tags?: string[]
}

defineProps<{ post: PostLike }>()
</script>

<template>
  <article
    class="soft-shadow group relative mb-3 rounded-xl border border-slate-200 bg-white px-4 py-5 sm:mb-6 sm:px-6 sm:py-7"
  >
    <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-slate-500 sm:gap-x-3 sm:gap-y-2 sm:text-sm">
      <time v-if="post.date" :datetime="isoDate(post.date)">
        {{ formatDate(post.date) }}
      </time>
      <span v-if="post.date && (post.category || post.tags?.length)" class="text-slate-300">·</span>
      <CategoryBadge v-if="post.category" :category="post.category" class="relative z-10" />
      <div v-if="post.tags?.length" class="flex flex-wrap gap-1.5">
        <TagBadge v-for="t in post.tags" :key="t" :tag="t" class="relative z-10" />
      </div>
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
