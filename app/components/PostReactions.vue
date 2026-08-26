<script setup lang="ts">
import type { PostStats } from '~/types/blog'

const props = defineProps<{ slug: string }>()

const { data: stats, status } = await useFetch<PostStats>(() => `/api/posts/${props.slug}/stats`, {
  key: () => `stats-${props.slug}`,
  default: () => ({ views: 0, likes: 0, comments: 0, liked: false }),
  immediate: import.meta.server,
})

const ready = ref(status.value === 'success')

const showPlaceholder = useLoadingHold(computed(() => !ready.value))

const pending = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    stats.value = await $fetch<PostStats>(`/api/posts/${props.slug}/view`, { method: 'POST' })
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
