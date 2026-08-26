<script setup lang="ts">
import { IconEye, IconHeart, IconMessageCircle } from '@tabler/icons-vue'
import type { PostStats } from '~/types/blog'

const props = defineProps<{ slug: string }>()

const { data: stats, status } = await useFetch<PostStats>(() => `/api/posts/${props.slug}/stats`, {
  key: () => `stats-${props.slug}`,
  default: () => ({ views: 0, likes: 0, comments: 0, liked: false }),
  immediate: import.meta.server,
})

const ready = ref(status.value === 'success')
watch(status, value => {
  if (value === 'success') ready.value = true
})

watch(stats, () => {
  ready.value = true
}, { deep: true })
</script>

<template>
  <div
    v-if="ready"
    class="mt-5 flex items-center justify-center gap-4 text-sm text-white/90 sm:gap-5"
    aria-label="文章统计"
  >
    <span class="inline-flex items-center gap-1.5" title="点赞量">
      <IconHeart :size="17" stroke="1.8" aria-hidden="true" />
      <span class="tabular-nums">{{ stats.likes }}</span>
    </span>
    <span class="inline-flex items-center gap-1.5" title="评论量">
      <IconMessageCircle :size="17" stroke="1.8" aria-hidden="true" />
      <span class="tabular-nums">{{ stats.comments }}</span>
    </span>
    <span class="inline-flex items-center gap-1.5" title="阅读量">
      <IconEye :size="17" stroke="1.8" aria-hidden="true" />
      <span class="tabular-nums">{{ stats.views }}</span>
    </span>
  </div>
  <div v-else class="mt-5 h-5 w-36 rounded-full bg-white/20" aria-hidden="true" />
</template>
