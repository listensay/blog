<script setup lang="ts">
import { IconEye, IconHeart } from '@tabler/icons-vue'
import type { EngagementTarget, PostStats } from '~/types/blog'

const { t } = useLocale()

const props = defineProps<{ target: EngagementTarget }>()

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
    error.value = apiErrorMessage(e, t('couldNotUpdateYourLikePleaseTryAgain'))
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="mt-8 rounded-2xl bg-white p-5 shadow sm:p-6">
    <div class="flex flex-wrap items-center justify-between gap-5">
      <div v-if="countsViews" class="min-w-0">
        <div v-if="showPlaceholder" class="skeleton h-4 w-20" aria-hidden="true" />
        <p v-else class="flex items-center gap-1.5 text-xs text-slate-500">
          <IconEye :size="14" stroke="1.8" aria-hidden="true" />
          <span class="tabular-nums">{{ stats.views }}</span>
          <span>{{ t('views') }}</span>
        </p>
      </div>

      <div v-if="showPlaceholder" class="skeleton h-12 w-32 rounded-full" aria-hidden="true" />
      <button
        v-else
        type="button"
        :disabled="pending"
        :aria-pressed="stats.liked"
        :aria-label="stats.liked ? t('unlike') : t('like')"
        class="group inline-flex min-h-12 shrink-0 items-center justify-center gap-2.5 rounded-full border px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
        :class="stats.liked
          ? 'border-rose-600 bg-rose-600 text-white hover:border-rose-700 hover:bg-rose-700'
          : 'border-rose-200 bg-rose-100 text-rose-800 hover:border-rose-300 hover:bg-rose-200'"
        @click="toggleLike"
      >
        <IconHeart
          :size="20"
          stroke="1.8"
          :fill="stats.liked ? 'currentColor' : 'none'"
          aria-hidden="true"
          class="transition-transform group-active:scale-90"
        />
        <span
          class="min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs tabular-nums"
          :class="stats.liked ? 'bg-white/20 text-white' : 'bg-rose-200/70 text-rose-800'"
        >{{ stats.likes }}</span>
      </button>
    </div>

    <p v-if="error" role="alert" class="mt-3 text-xs text-red-700">
      {{ error }}
    </p>
  </div>
</template>
