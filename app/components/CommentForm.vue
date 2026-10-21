<script setup lang="ts">
import type { CommentListResponse, CommentNode, EngagementTarget } from '~/types/blog'

const props = defineProps<{
  target: EngagementTarget
  parent?: CommentNode | null
}>()

const emit = defineEmits<{
  submitted: [result: CommentListResponse]
  cancel: []
}>()

const MAX_BODY = 1000

const { identity, remember } = useCommentIdentity()
const body = ref('')
const homepage = ref('')

const pending = ref(false)
const error = ref('')
const done = ref('')

const remaining = computed(() => MAX_BODY - [...body.value].length)
const canSubmit = computed(() =>
  !pending.value && identity.value.author.trim() !== '' && body.value.trim() !== '' && remaining.value >= 0,
)

async function submit() {
  if (!canSubmit.value) return
  pending.value = true
  error.value = ''
  done.value = ''

  try {
    const result = await $fetch<CommentListResponse & { id: string }>(
      commentsUrl(props.target),
      {
        method: 'POST',
        body: {
          author: identity.value.author,
          email: identity.value.email,
          website: identity.value.website,
          body: body.value,
          parentId: props.parent?.id ?? null,
          homepage: homepage.value,
        },
      },
    )

    body.value = ''
    remember()
    done.value = '评论已发布'
    emit('submitted', result)
  }
  catch (e) {
    error.value = apiErrorMessage(e, '评论提交失败，请重试')
  }
  finally {
    pending.value = false
  }
}

</script>

<template>
  <form
    class="rounded-[5px] border border-panel-line bg-panel-raised p-4"
    :class="parent ? 'mt-3' : ''"
    @submit.prevent="submit"
  >
    <div v-if="parent" class="mb-3 flex items-center justify-between text-xs text-panel-muted">
      <span>回复 <span class="font-medium text-panel-text">@{{ parent.author }}</span></span>
      <button type="button" class="text-panel-muted transition-colors hover:text-accent" @click="emit('cancel')">
        取消
      </button>
    </div>

    <div class="grid gap-3 sm:grid-cols-3">
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-panel-muted">昵称 <span class="text-accent">*</span></span>
        <input
          v-model="identity.author"
          type="text"
          name="author"
          maxlength="24"
          required
          autocomplete="nickname"
          class="w-full rounded-[5px] border border-panel-line bg-panel-raised px-3 py-2 text-sm text-panel-text transition-colors placeholder:text-panel-muted hover:border-accent/50 focus:border-accent"
        >
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-panel-muted">邮箱（不公开）</span>
        <input
          v-model="identity.email"
          type="email"
          name="email"
          maxlength="120"
          autocomplete="email"
          class="w-full rounded-[5px] border border-panel-line bg-panel-raised px-3 py-2 text-sm text-panel-text transition-colors placeholder:text-panel-muted hover:border-accent/50 focus:border-accent"
        >
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-panel-muted">网址（选填）</span>
        <input
          v-model="identity.website"
          type="url"
          name="url"
          maxlength="200"
          autocomplete="url"
          placeholder="https://"
          class="w-full rounded-[5px] border border-panel-line bg-panel-raised px-3 py-2 text-sm text-panel-text transition-colors placeholder:text-panel-muted hover:border-accent/50 focus:border-accent"
        >
      </label>
    </div>

    <div class="absolute left-[-9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
      <label>
        Homepage
        <input v-model="homepage" type="text" name="homepage" tabindex="-1" autocomplete="off">
      </label>
    </div>

    <label class="mt-3 block">
      <span class="sr-only">评论内容</span>
      <textarea
        v-model="body"
        name="body"
        rows="4"
        required
        placeholder="评论内容"
        class="w-full resize-y rounded-[5px] border border-panel-line bg-panel-raised px-3 py-2 text-sm text-panel-text transition-colors placeholder:text-panel-muted hover:border-accent/50 focus:border-accent"
      />
    </label>

    <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p v-if="remaining < 100" class="text-xs" :class="remaining < 0 ? 'text-danger' : 'text-panel-muted'">
        {{ remaining < 0 ? `超出 ${-remaining} 字` : `剩余 ${remaining} 字` }}
      </p>

      <button
        type="submit"
        :disabled="!canSubmit"
        class="ml-auto inline-flex min-h-11 items-center rounded-[4px] border border-accent bg-accent px-4 py-2 text-sm font-medium text-panel transition-colors enabled:hover:border-accent/90 enabled:hover:bg-accent/90 disabled:cursor-not-allowed disabled:border-panel-line disabled:bg-panel-line disabled:text-panel-muted"
      >
        {{ pending ? '发送中…' : parent ? '回复' : '发表评论' }}
      </button>
    </div>

    <p v-if="error" class="mt-2 text-xs text-danger">
      {{ error }}
    </p>
    <p v-else-if="done" class="mt-2 text-xs text-[#c7b7ed]">
      {{ done }}
    </p>
  </form>
</template>
