<script setup lang="ts">
import type { CommentListResponse, CommentNode, EngagementTarget } from '~/types/blog'

const { t } = useLocale()

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
    done.value = t('commentPublished')
    emit('submitted', result)
  }
  catch (e) {
    error.value = apiErrorMessage(e, t('couldNotSendYourCommentPleaseTryAgain'))
  }
  finally {
    pending.value = false
  }
}

const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-400 focus:outline-none'
</script>

<template>
  <form
    class="rounded-xl border border-slate-200 bg-white p-4"
    :class="parent ? 'mt-3' : ''"
    @submit.prevent="submit"
  >
    <div v-if="parent" class="mb-3 flex items-center justify-between text-xs text-slate-500">
      <span>{{ t('replyingTo') }} <span class="font-medium text-slate-700">@{{ parent.author }}</span></span>
      <button type="button" class="text-slate-400 transition-colors hover:text-slate-600" @click="emit('cancel')">
        {{ t('cancel') }}
      </button>
    </div>

    <div class="grid gap-3 sm:grid-cols-3">
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-500">{{ t('name') }} <span class="text-brand-600">*</span></span>
        <input
          v-model="identity.author"
          type="text"
          name="author"
          maxlength="24"
          required
          autocomplete="nickname"
          :placeholder="t('yourName')"
          :class="inputClass"
        >
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-500">{{ t('emailPrivate') }}</span>
        <input
          v-model="identity.email"
          type="email"
          name="email"
          maxlength="120"
          autocomplete="email"
          :placeholder="t('usedOnlyForYourAvatar')"
          :class="inputClass"
        >
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-500">{{ t('websiteOptional') }}</span>
        <input
          v-model="identity.website"
          type="url"
          name="url"
          maxlength="200"
          autocomplete="url"
          placeholder="https://"
          :class="inputClass"
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
      <span class="sr-only">{{ t('comment') }}</span>
      <textarea
        v-model="body"
        name="body"
        rows="4"
        required
        :placeholder="parent ? t('replyPlaceholder', { name: parent.author }) : t('shareYourThoughtsLineBreaksAreSupportedHtmlIsNot')"
        :class="`${inputClass} resize-y`"
      />
    </label>

    <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p class="text-xs" :class="remaining < 0 ? 'text-red-500' : 'text-slate-400'">
        <template v-if="remaining < 100">{{ t('remainingCharacters', { count: remaining }) }}</template>
        <template v-else>{{ t('commentsAppearImmediatelyPleaseBeKind') }}</template>
      </p>

      <button
        type="submit"
        :disabled="!canSubmit"
        class="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {{ pending ? t('sending') : parent ? t('reply') : t('postComment') }}
      </button>
    </div>

    <p v-if="error" class="mt-2 text-xs text-red-500">
      {{ error }}
    </p>
    <p v-else-if="done" class="mt-2 text-xs text-brand-600">
      {{ done }}
    </p>
  </form>
</template>
