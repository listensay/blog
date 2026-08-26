<script setup lang="ts">
import type { CommentListResponse, CommentNode, PostStats } from '~/types/blog'

const props = defineProps<{ slug: string }>()

const { data, refresh, status } = await useFetch<CommentListResponse>(
  () => `/api/posts/${props.slug}/comments`,
  {
    key: () => `comments-${props.slug}`,
    default: () => ({ total: 0, comments: [] }),
    lazy: true,
  },
)

const { loading } = useQueryState(status)

const replyTo = ref<CommentNode | null>(null)
const { data: sharedStats } = useNuxtData<PostStats>(`stats-${props.slug}`)

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
  <section id="comments" class="mt-12 border-t border-slate-200 pt-8 sm:mt-16 sm:pt-10">
    <div class="flex items-end justify-between">
      <h2 class="text-lg font-semibold tracking-tight text-slate-900">
        评论
        <span v-if="data.total" class="ml-1 text-sm font-normal text-slate-400">{{ data.total }}</span>
      </h2>
      <button
        type="button"
        class="text-xs text-slate-400 transition-colors hover:text-brand-600"
        :disabled="status === 'pending'"
        @click="refresh()"
      >
        {{ status === 'pending' ? '刷新中…' : '刷新' }}
      </button>
    </div>

    <div class="mt-5">
      <CommentForm v-if="!replyTo" :slug="slug" @submitted="onSubmitted" />
    </div>

    <CommentsSkeleton v-if="loading" class="mt-8" :count="2" />

    <p v-else-if="status === 'error'" class="mt-6 text-sm text-slate-400">
      评论没加载出来，点上面的「刷新」再试一次。
    </p>

    <p v-else-if="!data.comments.length" class="mt-6 text-sm text-slate-400">
      还没有人评论，来抢个沙发。
    </p>

    <ul v-else class="mt-8 space-y-7">
      <li v-for="(comment, i) in data.comments" :key="comment.id" v-reveal="i">
        <CommentItem :comment="comment" @reply="startReply">
          <template #form>
            <CommentForm
              v-if="replyTo?.id === comment.id"
              :slug="slug"
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
                  :slug="slug"
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
