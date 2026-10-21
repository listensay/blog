<script setup lang="ts">
import type { CommentListResponse, CommentNode, EngagementTarget, PostStats } from '~/types/blog'

const props = withDefaults(defineProps<{
  target: EngagementTarget
  variant?: 'panel' | 'inline'
  collapsible?: boolean
}>(), { variant: 'panel', collapsible: false })

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
const formExpanded = ref(!props.collapsible)
const formId = useId()
const submitted = ref(false)
const { data: sharedStats } = useNuxtData<PostStats>(statsKey(props.target))

watch(() => data.value.total, total => {
  if (sharedStats.value) sharedStats.value.comments = total
})

function startReply(comment: CommentNode) {
  replyTo.value = replyTo.value?.id === comment.id ? null : comment
  submitted.value = false
}

function toggleForm() {
  formExpanded.value = replyTo.value ? true : !formExpanded.value
  replyTo.value = null
  submitted.value = false
}

function onSubmitted(result: CommentListResponse) {
  data.value = { total: result.total, comments: result.comments }
  replyTo.value = null
  if (props.collapsible) {
    formExpanded.value = false
    submitted.value = true
  }
  void refreshNuxtData('recent-comments')
}
</script>

<template>
  <section id="comments" class="scroll-mt-6" :class="variant === 'inline' ? 'mt-10 border-t border-panel-line pt-8' : 'mt-8 rounded-[5px] bg-panel-raised p-5 shadow-none sm:p-6'">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-xl font-semibold text-panel-text">
        评论
        <span v-if="data.total" class="ml-1 text-sm font-normal text-panel-muted">{{ data.total }}</span>
      </h2>
      <div class="flex items-center gap-3">
        <button
          v-if="collapsible"
          type="button"
          class="inline-flex min-h-11 items-center rounded-sm border border-panel-line px-4 text-sm text-panel-muted transition-colors hover:border-accent/50 hover:bg-white/5 hover:text-accent"
          :aria-expanded="formExpanded && !replyTo"
          :aria-controls="formId"
          @click="toggleForm"
        >{{ formExpanded && !replyTo ? '收起' : '写评论' }}</button>
        <button
          type="button"
          class="min-h-11 px-2 text-sm text-panel-muted transition-colors hover:text-accent disabled:cursor-default"
          :disabled="status === 'pending'"
          @click="refresh()"
        >
          {{ status === 'pending' ? '刷新中…' : '刷新' }}
        </button>
      </div>
    </div>

    <div :id="formId" v-show="formExpanded && !replyTo" class="mt-6">
      <CommentForm :target="target" @submitted="onSubmitted" />
    </div>

    <p v-if="submitted" role="status" class="mt-4 text-sm text-panel-text">评论已发布</p>

    <CommentsSkeleton v-if="loading" class="mt-8" :count="2" />

    <p v-else-if="status === 'error'" role="alert" class="mt-6 text-sm text-danger">
      评论加载失败，请刷新重试
    </p>

    <p v-else-if="!data.comments.length" class="mt-6 text-sm text-panel-muted">
      暂无评论
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
