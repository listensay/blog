<script setup lang="ts">
import { IconArrowUpRight, IconLink, IconMessageCircle, IconRefresh } from '@tabler/icons-vue'
import type { RecentComment } from '~/types/blog'
import { NuxtLink } from '#components'

const route = useRoute()
const { data: comments, status: commentStatus, error: commentError, refresh: refreshComments } = await useFetch<RecentComment[]>(
  '/api/comments/recent',
  { key: 'recent-comments', lazy: true, default: () => [] },
)
const { data: linksPage, status: linksStatus, error: linksError, refresh: refreshLinks } = await useAsyncData(
  'sidebar-links',
  () => queryCollection('pages').path('/links').select('friends').first(),
  { lazy: true },
)
const friends = computed(() => linksPage.value?.friends.slice(0, 6) ?? [])
const commentsLoading = computed(() => commentStatus.value === 'idle' || commentStatus.value === 'pending')
const linksLoading = computed(() => linksStatus.value === 'idle' || linksStatus.value === 'pending')

watch(() => route.path, () => refreshComments())
</script>

<template>
  <aside class="
          site-sidebar lg:min-h-0 lg:overflow-y-auto lg:overscroll-y-contain
          lg:no-scrollbar sticky top-6 min-w-0 border-l border-panel-line pl-[22px] max-[1200px]:pl-[16px]
          max-lg:static max-lg:[border-left:0] max-lg:[border-top:1px_solid_var(--color-panel-line)] max-lg:p-[25px_0_0]
          max-lg:mt-[14px] md:max-lg:flex max-lg:flex-col max-lg:min-h-[0] max-lg:max-h-[none] max-md:hidden
          max-[360px]:grid-cols-[1fr] lg:static
        " aria-label="侧栏">
    <div class="sidebar-feed flex flex-col max-lg:grid max-lg:grid-cols-[repeat(2,_minmax(0,1fr))] max-lg:gap-[24px] max-lg:overflow-visible max-md:grid-cols-[minmax(0,1fr)]">
      <section class="sidebar-section [&+.sidebar-section]:mt-[32px] max-lg:[&+.sidebar-section]:mt-[0]" aria-labelledby="recent-comments-title">
        <div class="
          sidebar-heading flex items-center justify-between gap-[8px] mb-[16px] [&_h2]:flex [&_h2]:gap-[7px] [&_h2]:items-center
          [&_h2]:text-[#e0dbea] [&_h2]:font-medium [&_h2]:text-base [&_h2_svg]:text-[#a6a0bc] max-md:[&_h2]:text-base
          max-md:[&_h2_svg]:w-[14px]
        ">
          <h2 id="recent-comments-title"><IconMessageCircle :size="17" stroke="1.6" aria-hidden="true" />最新评论</h2>
          <button type="button" class="sidebar-refresh grid place-items-center text-[#9992b2] cursor-pointer w-[28px] h-[28px] hover:text-accent disabled:cursor-default" aria-label="刷新评论" title="刷新评论" :disabled="commentsLoading" @click="refreshComments()">
            <IconRefresh :size="15" stroke="1.7" :class="{ 'animate-spin': commentsLoading }" aria-hidden="true" />
          </button>
        </div>
        <div v-if="commentsLoading" class="sidebar-loading flex flex-col gap-[20px]" role="status">
          <span class="sr-only">正在加载评论</span>
          <div v-for="n in 3" :key="n" aria-hidden="true">
            <div class="sidebar-comment-author flex min-w-0 items-center gap-2.5 [&_.sidebar-item-name]:min-w-0 [&_.sidebar-item-name]:flex-1"><span class="skeleton size-9 shrink-0 rounded-full" /><span class="skeleton h-3 w-1/2" /></div>
            <span class="skeleton mt-2 block h-3 w-full" />
          </div>
        </div>
        <p v-else-if="commentError" class="sidebar-status p-[16px_0] text-[#d5b5a5] text-sm [&_button]:ml-[6px] [&_button]:text-accent [&_button]:cursor-pointer" role="alert">评论加载失败 <button type="button" @click="refreshComments()">重试</button></p>
        <ul v-else-if="comments.length" class="sidebar-list flex flex-col gap-[19px]">
          <li v-for="comment in comments" :key="comment.id">
            <a :href="`${comment.path}#comments`" class="sidebar-item sidebar-comment group gap-[10px] items-center min-w-[0] max-md:gap-[8px] [&:hover_.sidebar-item-name]:text-accent block">
              <span class="sidebar-comment-author flex min-w-0 items-center gap-2.5 [&_.sidebar-item-name]:min-w-0 [&_.sidebar-item-name]:flex-1">
                <span class="
          sidebar-avatar rounded-full grid place-items-center shrink-0 w-[36px] h-[36px] object-cover
          [background:hsl(var(--avatar-hue,_260)_30%_72%)] [color:hsl(var(--avatar-hue,_260)_30%_25%)] text-[15px] font-semibold
          max-md:w-[30px] max-md:h-[30px]
        " :style="{ '--avatar-hue': comment.hue }" aria-hidden="true">{{ [...comment.author][0] }}</span>
                <span class="sidebar-item-name block text-[#f1eef6] leading-[1.5] whitespace-nowrap overflow-hidden text-ellipsis text-base">{{ comment.author }}</span>
              </span>
              <span class="sidebar-comment-body mt-2 block truncate text-[#bcb5cf] leading-[1.7] text-sm" :title="comment.body">{{ comment.body }}</span>
              <span class="sidebar-item-meta block mt-[4px] text-[#9790aa] overflow-hidden text-ellipsis whitespace-nowrap text-xs">{{ comment.title }}</span>
            </a>
          </li>
        </ul>
        <div v-else class="sidebar-empty flex flex-col items-center justify-center gap-[10px] min-h-[118px] [border:1px_dashed_#353046] bg-[#ffffff02] text-[#a19bb5] text-sm max-md:min-h-[112px] [&_svg]:text-[#8c82ab]">
          <IconMessageCircle :size="28" stroke="1.3" aria-hidden="true" />
          <p>暂无评论</p>
        </div>
      </section>

      <section class="sidebar-section [&+.sidebar-section]:mt-[32px] max-lg:[&+.sidebar-section]:mt-[0]" aria-labelledby="friend-links-title">
        <div class="
          sidebar-heading flex items-center justify-between gap-[8px] mb-[16px] [&_h2]:flex [&_h2]:gap-[7px] [&_h2]:items-center
          [&_h2]:text-[#e0dbea] [&_h2]:font-medium [&_h2]:text-base [&_h2_svg]:text-[#a6a0bc] max-md:[&_h2]:text-base
          max-md:[&_h2_svg]:w-[14px]
        ">
          <h2 id="friend-links-title"><IconLink :size="17" stroke="1.6" aria-hidden="true" />友情链接</h2>
          <NuxtLink to="/links" class="sidebar-more inline-flex items-center gap-[5px] text-accent whitespace-nowrap text-sm max-md:gap-[1px] max-md:text-xs hover:text-[#ffe7a9]">全部 <IconArrowUpRight :size="13" aria-hidden="true" /></NuxtLink>
        </div>
        <div v-if="linksLoading" class="sidebar-loading flex flex-col gap-[20px]" role="status">
          <span class="sr-only">正在加载友情链接</span>
          <div v-for="n in 3" :key="n" class="sidebar-skeleton flex gap-[10px] items-center" aria-hidden="true"><span class="skeleton size-10" /><span class="skeleton h-3 w-1/2" /></div>
        </div>
        <p v-else-if="linksError" class="sidebar-status p-[16px_0] text-[#d5b5a5] text-sm [&_button]:ml-[6px] [&_button]:text-accent [&_button]:cursor-pointer" role="alert">友情链接加载失败 <button type="button" @click="refreshLinks()">重试</button></p>
        <ul v-else-if="friends.length" class="sidebar-list flex flex-col gap-[19px]">
          <li v-for="friend in friends" :key="friend.url">
            <component
              :is="/^https?:\/\//i.test(friend.url) ? 'a' : NuxtLink"
              v-bind="/^https?:\/\//i.test(friend.url)
                ? { href: friend.url, target: '_blank', rel: 'noopener noreferrer' }
                : { to: friend.url }"
              class="sidebar-item flex gap-[10px] items-center min-w-[0] max-md:gap-[8px] [&:hover_.sidebar-item-name]:text-accent"
            >
              <img v-if="friend.avatar" :src="friend.avatar" alt="" width="40" height="40" loading="lazy" class="
          sidebar-avatar rounded-sm grid place-items-center shrink-0 w-[36px] h-[36px] object-cover
          [background:hsl(var(--avatar-hue,_260)_30%_72%)] [color:hsl(var(--avatar-hue,_260)_30%_25%)] text-[15px] font-semibold
          max-md:w-[30px] max-md:h-[30px]
        ">
              <span v-else class="
          sidebar-avatar rounded-sm friend-avatar grid place-items-center shrink-0 w-[36px] h-[36px] object-cover
          [background:hsl(var(--avatar-hue,_260)_30%_72%)] [color:hsl(var(--avatar-hue,_260)_30%_25%)] text-[15px] font-semibold
          max-md:w-[30px] max-md:h-[30px] bg-[#b7cd8d] text-[#455735]
        " aria-hidden="true">{{ [...friend.name][0] }}</span>
              <span class="sidebar-item-copy flex-1 min-w-[0]"><span class="sidebar-item-name block text-[#f1eef6] leading-[1.5] whitespace-nowrap overflow-hidden text-ellipsis text-base">{{ friend.name }}</span><span v-if="friend.description" class="sidebar-item-meta block mt-[4px] text-[#9790aa] overflow-hidden text-ellipsis whitespace-nowrap text-xs">{{ friend.description }}</span></span>
              <IconArrowUpRight :size="14" class="sidebar-link-arrow shrink-0 text-[#9790aa] max-md:hidden" aria-hidden="true" />
            </component>
          </li>
        </ul>
        <div v-else class="sidebar-empty flex flex-col items-center justify-center gap-[10px] min-h-[118px] [border:1px_dashed_#353046] bg-[#ffffff02] text-[#a19bb5] text-sm max-md:min-h-[112px] [&_svg]:text-[#8c82ab]">
          <IconLink :size="28" stroke="1.3" aria-hidden="true" />
          <p>暂无友情链接</p>
        </div>
      </section>
    </div>
  </aside>
</template>
