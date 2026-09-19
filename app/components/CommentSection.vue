<script setup lang="ts">
import type { CommentListResponse, CommentNode, EngagementTarget, PostStats } from '~/types/blog'

const { t } = useLocale()

const props = defineProps<{ target: EngagementTarget }>()

const { data, refresh, status } = await useFetch<CommentListResponse>(
  () => commentsUrl(props.target),
  {
    key: () => commentsKey(props.target),
    default: () => ({ total: 0, comments: [] }),
    lazy: true,
  },
)

const { loading } = useQueryState(status)

const replyTo = ref<CommentNode | null>(null)
const { data: sharedStats } = useNuxtData<PostStats>(statsKey(props.target))

watch(() => data.value.total, total => {
  if (sharedStats.value) sharedStats.value.comments = total
})

function startReply(comment: CommentNode) {
  replyTo.value = replyTo.value?.id === comment.id ? null : comment
}

function onSubmitted(result: CommentListResponse) {
  data.value = { total: result.total, comments: result.comments }
  replyTo.value = null
}
</script>

<template>
  <section id="comments" class="mt-8 rounded-2xl bg-white p-5 shadow sm:p-6">
    <div class="flex items-end justify-between">
      <h2 class="text-lg font-semibold tracking-tight text-slate-900">
        {{ t('comments') }}
        <span v-if="data.total" class="ml-1 text-sm font-normal text-slate-400">{{ data.total }}</span>
      </h2>
      <button
        type="button"
        class="text-xs text-slate-400 transition-colors hover:text-brand-600"
        :disabled="status === 'pending'"
        @click="refresh()"
      >
        {{ status === 'pending' ? t('refreshing') : t('refresh') }}
      </button>
    </div>

    <div class="mt-5">
      <CommentForm v-if="!replyTo" :target="target" @submitted="onSubmitted" />
    </div>

    <CommentsSkeleton v-if="loading" class="mt-8" :count="2" />

    <p v-else-if="status === 'error'" class="mt-6 text-sm text-slate-400">
      {{ t('couldNotLoadCommentsUseRefreshToTryAgain') }}
    </p>

    <p v-else-if="!data.comments.length" class="mt-6 text-sm text-slate-400">
      {{ t('noCommentsYetBeTheFirstToJoinTheConversation') }}
    </p>

    <ul v-else class="mt-8 space-y-7">
      <li v-for="(comment, i) in data.comments" :key="comment.id" v-reveal="i">
        <CommentItem :comment="comment" @reply="startReply">
          <template #form>
            <CommentForm
              v-if="replyTo?.id === comment.id"
              :target="target"
              :parent="comment"
              @submitted="onSubmitted"
              @cancel="replyTo = null"
            />
          </template>

          <template #replies>
            <CommentItem
              v-for="reply in comment.replies"
              :key="reply.id"
              :comment="reply"
              nested
              @reply="startReply"
            >
              <template #form>
                <CommentForm
                  v-if="replyTo?.id === reply.id"
                  :target="target"
                  :parent="reply"
                  @submitted="onSubmitted"
                  @cancel="replyTo = null"
                />
              </template>
            </CommentItem>
          </template>
        </CommentItem>
      </li>
    </ul>
  </section>
</template>
