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
  <article class="group relative border border-slate-200 py-8 bg-white p-4 mb-4 rounded-xl">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-500">
      <time v-if="post.date" :datetime="isoDate(post.date)">
        {{ formatDate(post.date) }}
      </time>
      <span v-if="post.date && (post.category || post.tags?.length)" class="text-slate-300">·</span>
      <CategoryBadge v-if="post.category" :category="post.category" class="relative z-10" />
      <div v-if="post.tags?.length" class="flex flex-wrap gap-1.5">
        <TagBadge v-for="t in post.tags" :key="t" :tag="t" class="relative z-10" />
      </div>
    </div>

    <h2 class="mt-3 text-xl font-semibold tracking-tight text-slate-900">
      <NuxtLink :to="post.path">
        <!-- 覆盖整卡的点击区域，同时保留标签的独立链接 -->
        <span class="absolute inset-0" aria-hidden="true" />
        {{ post.title }}
      </NuxtLink>
    </h2>

    <p v-if="post.description" class="mt-2 text-slate-600">
      {{ post.description }}
    </p>
  </article>
</template>
