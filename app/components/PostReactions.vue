<script setup lang="ts">
import type { PostStats } from '~/types/blog'

const props = defineProps<{ slug: string }>()

// 首屏就带上数字，避免读者看到 0 再跳变。
// 客户端刻意不重复取：挂载后那次 POST /view 本来就会把最新数字带回来，
// 两边同时发会互相覆盖——后回来的那个赢，浏览量可能就少算一次。
const { data: stats, status } = await useFetch<PostStats>(() => `/api/posts/${props.slug}/stats`, {
  key: () => `stats-${props.slug}`,
  default: () => ({ views: 0, likes: 0, liked: false }),
  immediate: import.meta.server,
})

// 前端跳转过来的那一下还没有真实数字：hydration 时 status 已经是 success（数据在
// payload 里），换路由过来则是 idle。后者先占位，别把默认值 0 当结果显示出去。
const ready = ref(status.value === 'success')

// 和列表页共用同一套节奏：占位一旦出现就撑够最短时长，不然只是闪一下
const showPlaceholder = useLoadingHold(computed(() => !ready.value))

const pending = ref(false)
const error = ref('')

// 浏览量在挂载后才计数：放在 SSR 里会把爬虫、预取、探活请求全算进去
onMounted(async () => {
  try {
    stats.value = await $fetch<PostStats>(`/api/posts/${props.slug}/view`, { method: 'POST' })
  }
  catch {
    // 计数失败不影响读文章，静默处理
  }
  finally {
    ready.value = true
  }
})

async function toggleLike() {
  if (pending.value) return
  pending.value = true
  error.value = ''

  // 先改 UI 再发请求，失败回滚——点赞必须是零延迟的手感
  const snapshot = { ...stats.value }
  stats.value = {
    views: snapshot.views,
    liked: !snapshot.liked,
    likes: Math.max(0, snapshot.likes + (snapshot.liked ? -1 : 1)),
  }

  try {
    stats.value = await $fetch<PostStats>(`/api/posts/${props.slug}/like`, { method: 'POST' })
  }
  catch (e) {
    stats.value = snapshot
    error.value = apiErrorMessage(e, '点赞失败，稍后再试')
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="mt-12 flex flex-col items-center gap-3 border-t border-slate-200 pt-8">
    <!-- 数字还没到位：占位而不是显示 0，也不让人点到一个状态未知的赞 -->
    <template v-if="showPlaceholder">
      <div class="skeleton h-11 w-28 rounded-full" aria-hidden="true" />
      <div class="skeleton h-4 w-20" aria-hidden="true" />
    </template>

    <template v-else>
      <button
        type="button"
        :disabled="pending"
        :aria-pressed="stats.liked"
        :aria-label="stats.liked ? '取消点赞' : '点赞'"
        class="group inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60"
        :class="stats.liked
          ? 'border-brand-300 bg-brand-50 text-brand-700'
          : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700'"
        @click="toggleLike"
      >
        <svg
          class="size-4 transition-transform group-active:scale-90"
          viewBox="0 0 24 24"
          :fill="stats.liked ? 'currentColor' : 'none'"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1l8.1 8.1a1 1 0 0 0 1.4 0l8.1-8.1a5 5 0 0 0 0-7.1Z" />
        </svg>
        <span>{{ stats.liked ? '已赞' : '点赞' }}</span>
        <span class="tabular-nums">{{ stats.likes }}</span>
      </button>

      <p class="flex items-center gap-1.5 text-xs text-slate-400">
        <svg
          class="size-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span class="tabular-nums">{{ stats.views }}</span>
        <span>次阅读</span>
      </p>
    </template>

    <p v-if="error" class="text-xs text-red-500">
      {{ error }}
    </p>
  </div>
</template>
