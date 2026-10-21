<script setup lang="ts">
import { IconArrowUpRight, IconFileText } from '@tabler/icons-vue'
interface PostLike {
  path?: string
  title?: string
  description?: string
  date?: string
  tags?: string[]
  cover?: string
}

defineProps<{ post: PostLike, index?: number }>()

const thumbnailTones = [
  'bg-[#7cb9b8] text-[#326e6e]',
  'bg-[#b6cf91] text-[#52633d]',
  'bg-[#e8c772] text-[#856624]',
  'bg-[#b6a1db] text-[#65527f]',
]
</script>

<template>
  <article class="
          post-row relative isolate grid gap-3 content-center items-center px-4 py-5 min-h-[116px]
          [border-bottom:1px_solid_var(--color-panel-line)] max-[1200px]:gap-x-[9px] max-lg:gap-x-3 max-md:gap-x-3 max-md:gap-y-2
          max-md:px-3 max-md:py-[18px] max-md:min-h-[112px] before:pointer-events-none before:absolute before:inset-x-0
          before:inset-y-1 before:-z-1 before:rounded-sm before:bg-transparent before:transition-colors before:duration-150
          before:content-[''] last:[border-bottom:0] hover:before:bg-[#ffffff04] focus-within:before:bg-[#ffffff04]
          has-[.post-title_a:focus-visible]:outline-2 has-[.post-title_a:focus-visible]:outline-accent
          has-[.post-title_a:focus-visible]:outline-offset-2 group max-md:grid-cols-[64px_minmax(0,_1fr)]
        " :class="index !== undefined
      ? 'post-row-numbered md:max-lg:grid-cols-[24px_64px_minmax(0,_1fr)_88px_28px] lg:max-[1200px]:grid-cols-[18px_64px_minmax(0,_1fr)_88px_25px] min-[1200px]:grid-cols-[26px_80px_minmax(0,_1fr)_96px_28px]'
      : 'md:max-lg:grid-cols-[64px_minmax(0,_1fr)_88px_28px] lg:max-[1200px]:grid-cols-[64px_minmax(0,_1fr)_88px_25px] min-[1200px]:grid-cols-[80px_minmax(0,_1fr)_96px_28px]'">
    <span v-if="index !== undefined" class="post-number row-start-1 tabular-nums text-[#a9a4bf] text-xs max-md:hidden" aria-hidden="true">{{ String(index).padStart(2, '0') }}</span>
    <div class="post-summary contents">
      <div :class="index !== undefined ? 'md:col-start-2' : 'md:col-start-1'" class="post-thumbnail col-start-1 relative row-start-1 self-center size-20 aspect-square overflow-hidden rounded-sm max-[1200px]:size-16 max-md:self-start" aria-hidden="true">
        <img v-if="post.cover" :src="post.cover" alt="" loading="lazy" decoding="async" class="post-thumbnail-image absolute inset-0 size-full object-cover" width="80" height="80">
        <span v-else class="post-thumbnail-fallback absolute inset-0 grid place-items-center" :class="thumbnailTones[(index ?? 1) % 4]"><IconFileText :size="25" stroke="1.4" /></span>
      </div>
      <div :class="index !== undefined ? 'md:col-start-3' : 'md:col-start-2'" class="post-copy col-start-2 row-start-1 min-w-0 max-w-full max-md:pr-[28px]">
        <h2 class="post-title font-semibold leading-[1.7] text-[#f1eef9] text-base max-md:text-base [&_a:focus-visible]:outline-none [&_a:hover]:text-accent">
          <NuxtLink :to="post.path"><span class="post-hit-area absolute inset-[0]" aria-hidden="true" /><span class="post-title-text line-clamp-2 [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden wrap-anywhere">{{ post.title }}</span></NuxtLink>
        </h2>
        <p v-if="post.description" class="post-description mt-[4px] max-w-[72ch] text-[#a8a2bc] whitespace-nowrap overflow-hidden text-ellipsis text-sm md:mr-6">{{ post.description }}</p>
        <div v-if="post.tags?.length" class="post-tags relative z-[1] mt-[6px] flex flex-wrap gap-[5px]"><TagBadge v-for="tag in post.tags" :key="tag" :tag="tag" variant="list" /></div>
      </div>
    </div>
    <time v-if="post.date" :datetime="isoDateTime(post.date)" :title="formatDateTime(post.date)" class="post-date row-start-1 text-[#aaa3bd] tabular-nums whitespace-nowrap text-xs max-md:col-start-2 max-md:row-start-2 max-md:justify-self-end">{{ isoDate(post.date).replaceAll('-', '.') }}</time>
    <span v-else class="post-date row-start-1 text-[#aaa3bd] tabular-nums whitespace-nowrap text-xs max-md:col-start-2 max-md:row-start-2" />
    <span class="
          post-open row-start-1 grid w-[28px] h-[28px] justify-self-end place-items-center [border:1px_solid_var(--color-panel-line)]
          text-[#bbb3cf] max-md:absolute max-md:right-3 max-md:top-[22px] max-md:border-0 max-md:w-[20px]
          group-hover:[border-color:#f4d47b70] group-hover:text-accent
        " aria-hidden="true"><IconArrowUpRight :size="16" stroke="1.6" /></span>
  </article>
</template>
