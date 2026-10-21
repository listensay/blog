<script setup lang="ts">
import { IconEye, IconHeart, IconMessageCircle } from '@tabler/icons-vue'
import type { EngagementTarget, PostStats } from '~/types/blog'

const props = withDefaults(defineProps<{
  target: EngagementTarget
  variant?: 'panel' | 'inline'
  showComments?: boolean
}>(), { variant: 'panel', showComments: false })

const { data: stats, status } = await useFetch<PostStats>(() => statsUrl(props.target), {
  key: () => statsKey(props.target),
  default: () => ({ views: 0, likes: 0, comments: 0, liked: false }),
  immediate: import.meta.server,
})

const ready = ref(status.value === 'success')

const showPlaceholder = useLoadingHold(computed(() => !ready.value))

const pending = ref(false)
const error = ref('')

const countsViews = computed(() => props.target.kind === 'post')

onMounted(async () => {
  const view = viewUrl(props.target)

  // 文章每次进来都要记一次浏览；页面没这一步，服务端渲染取过就不再重取。
  if (!view && status.value === 'success') {
    ready.value = true
    return
  }

  try {
    stats.value = view
      ? await $fetch<PostStats>(view, { method: 'POST' })
      : await $fetch<PostStats>(statsUrl(props.target))
  }
  catch {
  }
  finally {
    ready.value = true
  }
})

async function toggleLike() {
  if (pending.value) return
  pending.value = true
  error.value = ''

  const snapshot = { ...stats.value }
  stats.value = {
    views: snapshot.views,
    liked: !snapshot.liked,
    likes: Math.max(0, snapshot.likes + (snapshot.liked ? -1 : 1)),
    comments: snapshot.comments,
  }

  try {
    stats.value = await $fetch<PostStats>(likeUrl(props.target), { method: 'POST' })
  }
  catch (e) {
    stats.value = snapshot
    error.value = apiErrorMessage(e, '点赞失败，请重试')
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div :class="variant === 'inline' ? 'mt-12 border-t border-panel-line pt-6' : 'mt-8 rounded-[5px] bg-panel-raised p-5 shadow-none sm:p-6'">
    <slot />
    <div class="flex flex-wrap items-center justify-between gap-5">
      <div v-if="countsViews || showComments" class="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
        <div v-if="showPlaceholder" class="skeleton h-4 w-20" aria-hidden="true" />
        <p v-else-if="countsViews" class="flex items-center gap-2 text-sm text-panel-muted">
          <IconEye :size="14" stroke="1.8" aria-hidden="true" />
          <span class="tabular-nums">{{ stats.views }}</span>
          <span>次阅读</span>
        </p>
        <a v-if="showComments && !showPlaceholder" href="#comments" class="inline-flex min-h-11 items-center gap-2 text-sm text-panel-muted transition-colors hover:text-accent">
          <IconMessageCircle :size="16" stroke="1.8" aria-hidden="true" />
          评论 <span class="tabular-nums">{{ stats.comments }}</span>
        </a>
      </div>

      <div v-if="showPlaceholder" class="skeleton h-12 w-24 rounded-[4px]" aria-hidden="true" />
      <button
        v-else
        type="button"
        :disabled="pending"
        :aria-pressed="stats.liked"
        :aria-label="stats.liked ? '取消点赞' : '点赞'"
        class="group inline-flex min-h-12 shrink-0 items-center justify-center gap-2.5 rounded-[4px] border px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
        :class="stats.liked
          ? 'border-accent/60 bg-accent/10 text-accent enabled:hover:border-accent enabled:hover:bg-accent/15'
          : 'border-panel-line bg-panel-raised text-panel-muted enabled:hover:border-accent/50 enabled:hover:bg-white/5 enabled:hover:text-accent'"
        @click="toggleLike"
      >
        <IconHeart
          :size="20"
          stroke="1.8"
          :fill="stats.liked ? 'currentColor' : 'none'"
          aria-hidden="true"
          class="transition-transform group-active:scale-90 motion-reduce:transform-none motion-reduce:transition-none"
        />
        <span
          class="min-w-6 text-center text-xs tabular-nums"
        >{{ stats.likes }}</span>
      </button>
    </div>

    <p v-if="error" role="alert" class="mt-3 text-xs text-danger">
      {{ error }}
    </p>
  </div>
</template>
