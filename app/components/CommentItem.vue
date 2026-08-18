<script setup lang="ts">
import type { CommentNode } from '~/types/blog'

const props = defineProps<{
  comment: CommentNode
  /** 回复项：缩进并去掉边框，视觉上归到父评论下面 */
  nested?: boolean
}>()

defineEmits<{ reply: [comment: CommentNode] }>()

// 相对时间依赖“现在”，服务端算出来的和客户端不一样会导致 hydration 警告。
// 所以首屏渲染绝对日期，挂载后再切成“3 分钟前”。
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})

const timeLabel = computed(() =>
  mounted.value ? relativeTime(props.comment.createdAt) : formatDate(props.comment.createdAt),
)

const initial = computed(() => [...props.comment.author][0] ?? '?')
</script>

<template>
  <div class="flex gap-2.5 sm:gap-3">
    <div
      class="grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold text-white select-none sm:size-9"
      :style="{ backgroundColor: `oklch(0.62 0.12 ${comment.hue})` }"
      aria-hidden="true"
    >
      {{ initial }}
    </div>

    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <a
          v-if="comment.website"
          :href="comment.website"
          target="_blank"
          rel="nofollow ugc noopener noreferrer"
          class="font-medium text-slate-900 hover:text-brand-700"
        >{{ comment.author }}</a>
        <span v-else class="font-medium text-slate-900">{{ comment.author }}</span>

        <span v-if="comment.replyTo" class="text-xs text-slate-400">
          回复 <span class="text-slate-500">@{{ comment.replyTo }}</span>
        </span>

        <time
          :datetime="isoDateTime(comment.createdAt)"
          :title="mounted ? localDateTime(comment.createdAt) : undefined"
          class="text-xs text-slate-400"
        >{{ timeLabel }}</time>
      </div>

      <!-- 用文本插值渲染，评论内容永远不会被当成 HTML 执行 -->
      <p class="mt-1.5 text-[0.9375rem] leading-relaxed whitespace-pre-wrap break-words text-slate-700">
        {{ comment.body }}
      </p>

      <button
        type="button"
        class="mt-1.5 text-xs text-slate-400 transition-colors hover:text-brand-600"
        @click="$emit('reply', comment)"
      >
        回复
      </button>

      <slot name="form" />

      <!-- 手机上宽度金贵：缩进和头像间距都收一档，回复层级仍看得出来 -->
      <div v-if="!nested && comment.replies.length" class="mt-4 space-y-4 border-l-2 border-slate-100 pl-2.5 sm:pl-4">
        <slot name="replies" />
      </div>
    </div>
  </div>
</template>
