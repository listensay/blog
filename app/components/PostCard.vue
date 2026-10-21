<script setup lang="ts">
import { IconArrowUpRight, IconFileText } from '@tabler/icons-vue'
import { taxonomyLabel, taxonomyLink } from '../utils/taxonomy'
interface PostLike {
  path?: string
  title?: string
  description?: string
  date?: string
  tags?: string[]
  cover?: string
}

withDefaults(defineProps<{ post: PostLike, index?: number, mobileLayout?: 'default' | 'light' }>(), {
  mobileLayout: 'default',
})

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
          [border-bottom:1px_solid_var(--color-panel-line)] max-[1200px]:gap-x-[9px] max-lg:gap-x-3
          before:pointer-events-none before:absolute before:inset-x-0
          before:inset-y-1 before:-z-1 before:rounded-sm before:bg-transparent before:transition-colors before:duration-150
          before:content-[''] last:[border-bottom:0] hover:before:bg-[#ffffff04] focus-within:before:bg-[#ffffff04]
          has-[.post-title_a:focus-visible]:outline-2 has-[.post-title_a:focus-visible]:outline-accent
          has-[.post-title_a:focus-visible]:outline-offset-2 group
        " :class="[mobileLayout === 'light'
      ? 'max-md:grid-cols-[minmax(0,_1fr)_56px] max-md:gap-4 max-md:items-start max-md:px-0 max-md:py-6 max-md:min-h-0'
      : 'max-md:grid-cols-[64px_minmax(0,_1fr)] max-md:gap-x-3 max-md:gap-y-2 max-md:px-3 max-md:py-[18px] max-md:min-h-[112px]', index !== undefined
      ? 'post-row-numbered md:max-lg:grid-cols-[24px_64px_minmax(0,_1fr)_88px_28px] lg:max-[1200px]:grid-cols-[18px_64px_minmax(0,_1fr)_88px_25px] min-[1200px]:grid-cols-[26px_80px_minmax(0,_1fr)_96px_28px]'
      : 'md:max-lg:grid-cols-[64px_minmax(0,_1fr)_88px_28px] lg:max-[1200px]:grid-cols-[64px_minmax(0,_1fr)_88px_25px] min-[1200px]:grid-cols-[80px_minmax(0,_1fr)_96px_28px]']">
    <span v-if="index !== undefined" class="post-number row-start-1 tabular-nums text-[#a9a4bf] text-xs max-md:hidden" aria-hidden="true">{{ String(index).padStart(2, '0') }}</span>
    <div class="post-summary contents">
      <div :class="[index !== undefined ? 'md:col-start-2' : 'md:col-start-1', mobileLayout === 'light' ? 'max-md:col-start-2 max-md:size-14 max-md:mt-1' : 'max-md:col-start-1']" class="post-thumbnail relative row-start-1 self-center size-20 aspect-square overflow-hidden rounded-sm max-[1200px]:size-16 max-md:self-start" aria-hidden="true">
        <img v-if="post.cover" :src="post.cover" alt="" loading="lazy" decoding="async" class="post-thumbnail-image absolute inset-0 size-full object-cover" width="80" height="80">
        <span v-else class="post-thumbnail-fallback absolute inset-0 grid place-items-center" :class="thumbnailTones[(index ?? 1) % 4]"><IconFileText :size="25" stroke="1.4" /></span>
      </div>
      <div :class="[index !== undefined ? 'md:col-start-3' : 'md:col-start-2', mobileLayout === 'light' ? 'max-md:col-start-1' : 'max-md:col-start-2 max-md:pr-[28px]']" class="post-copy row-start-1 min-w-0 max-w-full">
        <h2 :class="mobileLayout === 'light' ? 'max-md:text-[17px] max-md:leading-[1.65]' : ''" class="post-title font-semibold leading-[1.7] text-[#f1eef9] text-base [&_a:focus-visible]:outline-none [&_a:hover]:text-accent">
          <NuxtLink :to="post.path"><span class="post-hit-area absolute inset-[0]" aria-hidden="true" /><span :class="mobileLayout === 'light' ? 'max-md:line-clamp-none' : ''" class="post-title-text line-clamp-2 wrap-anywhere">{{ post.title }}</span></NuxtLink>
        </h2>
        <p v-if="post.description" :class="mobileLayout === 'light' ? 'max-md:hidden' : ''" class="post-description mt-[4px] max-w-[72ch] text-[#a8a2bc] whitespace-nowrap overflow-hidden text-ellipsis text-sm md:mr-6">{{ post.description }}</p>
        <div v-if="post.tags?.length" :class="mobileLayout === 'light' ? 'max-md:hidden' : ''" class="post-tags relative z-[1] mt-[6px] flex flex-wrap gap-[5px]"><TagBadge v-for="tag in post.tags" :key="tag" :tag="tag" variant="list" /></div>
        <div v-if="mobileLayout === 'light' && (post.date || post.tags?.length)" class="post-mobile-meta mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-[1.6] text-panel-muted md:hidden">
          <time v-if="post.date" :datetime="isoDateTime(post.date)" :title="formatDateTime(post.date)" class="tabular-nums whitespace-nowrap">{{ isoDate(post.date).replaceAll('-', '.') }}</time>
          <span v-if="post.date && post.tags?.length" aria-hidden="true">·</span>
          <NuxtLink v-if="post.tags?.length" :to="taxonomyLink('tags', post.tags[0]!)" class="post-mobile-tag relative z-[1] -my-3 inline-flex min-h-11 min-w-11 max-w-full items-center py-3 wrap-anywhere hover:text-accent">{{ taxonomyLabel(post.tags[0]!, 'tag') }}</NuxtLink>
        </div>
      </div>
    </div>
    <time v-if="post.date" :datetime="isoDateTime(post.date)" :title="formatDateTime(post.date)" :class="mobileLayout === 'light' ? 'max-md:hidden' : 'max-md:col-start-2 max-md:row-start-2 max-md:justify-self-end'" class="post-date row-start-1 text-[#aaa3bd] tabular-nums whitespace-nowrap text-xs">{{ isoDate(post.date).replaceAll('-', '.') }}</time>
    <span v-else :class="mobileLayout === 'light' ? 'max-md:hidden' : 'max-md:col-start-2 max-md:row-start-2'" class="post-date row-start-1 text-[#aaa3bd] tabular-nums whitespace-nowrap text-xs" />
    <span class="
          post-open row-start-1 grid w-[28px] h-[28px] justify-self-end place-items-center [border:1px_solid_var(--color-panel-line)]
          text-[#bbb3cf]
          group-hover:[border-color:#f4d47b70] group-hover:text-accent
        " :class="mobileLayout === 'light' ? 'max-md:hidden' : 'max-md:absolute max-md:right-3 max-md:top-[22px] max-md:border-0 max-md:w-[20px]'" aria-hidden="true"><IconArrowUpRight :size="16" stroke="1.6" /></span>
  </article>
</template>
