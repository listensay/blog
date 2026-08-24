<script setup lang="ts">
interface PostLike {
  path?: string
  title?: string
  description?: string
  /** `YYYY-MM-DD HH:mm`，见 app/utils/date.ts */
  date?: string
  category?: string
  tags?: string[]
  /**
   * 封面图，站点绝对路径（frontmatter 里写的相对路径已由 image-src transformer 改写）。
   * 没设封面就不显示缩略图，文字占满整行。
   */
  cover?: string
}

defineProps<{ post: PostLike }>()
</script>

<template>
  <article
    class="group relative flex gap-3.5 px-4 py-5 sm:gap-5 sm:px-6 sm:py-7 border-b last:border-none border-zinc-100"
  >
    <!--
      缩略图不用包链接：整块卡片已经靠标题里那层 `absolute inset-0` 覆盖成可点区域，
      再套一个 <a> 就成了嵌套链接。
      min-w-0 给右边的文字列 —— 没有它，长标题会把图挤变形。
      alt 刻意留空：整张卡片是一个链接、标题就在旁边，屏幕阅读器已经念过一遍了，
      再给图配个「XX 的封面」只是重复。装饰性图片按 WCAG 就该用空 alt。
    -->
    <img
      v-if="post.cover"
      :src="post.cover"
      alt=""
      loading="lazy"
      decoding="async"
      class="h-32 w-32 shrink-0 rounded-lg object-cover sm:h-36 sm:w-36"
    >

    <div class="min-w-0 flex-1">
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
    </div>
  </article>
</template>
