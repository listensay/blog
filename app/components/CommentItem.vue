<script setup lang="ts">
import type { CommentNode } from '~/types/blog'

const props = defineProps<{
  comment: CommentNode
  nested?: boolean
}>()

defineEmits<{ reply: [comment: CommentNode] }>()

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

      <div v-if="!nested && comment.replies.length" class="mt-4 space-y-4 border-l-2 border-slate-100 pl-2.5 sm:pl-4">
        <slot name="replies" />
      </div>
    </div>
  </div>
</template>
