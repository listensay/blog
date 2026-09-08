<script setup lang="ts">
interface PostLike {
  path?: string
  title?: string
  description?: string
  date?: string
  category?: string
  tags?: string[]
  cover?: string
}

defineProps<{ post: PostLike }>()
</script>

<template>
  <article
    class="group relative flex flex-col gap-3.5 px-4 py-5 sm:flex-row sm:gap-5 sm:px-6 sm:py-7 border-b last:border-none border-zinc-100"
  >
    <img
      v-if="post.cover"
      :src="post.cover"
      alt=""
      loading="lazy"
      decoding="async"
      class="aspect-video w-full rounded-lg bg-zinc-100 object-cover sm:aspect-square sm:h-48 sm:w-48 sm:shrink-0"
    >

    <div class="min-w-0 sm:flex-1">
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
          <!-- 截断放在内层：整卡点击遮罩是它的兄弟节点，不会被 line-clamp 的 overflow 裁掉 -->
          <span class="line-clamp-2 sm:line-clamp-none">{{ post.title }}</span>
        </NuxtLink>
      </h2>

      <p v-if="post.description" class="mt-1.5 line-clamp-2 text-sm text-slate-600 sm:mt-2 sm:text-base">
        {{ post.description }}
      </p>
    </div>
  </article>
</template>
