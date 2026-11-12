<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, ApiError } from '@/api'
import { confirmAction } from '@/composables/useFeedback'
import UiAlert from '@/components/ui/UiAlert.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiLoading from '@/components/ui/UiLoading.vue'
import type { AdminCommentsResponse } from '../../../app/types/blog'

const site = ref('')
const password = ref('')
const authed = ref(false)
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const result = ref<AdminCommentsResponse | null>(null)
const status = ref<'all' | 'visible' | 'hidden'>('all')
const offset = ref(0)
const total = computed(() =>
  status.value === 'all' ? result.value?.summary.total : result.value?.summary[status.value],
)
const tabs = [
  { value: 'all', label: '全部' },
  { value: 'visible', label: '显示中' },
  { value: 'hidden', label: '已隐藏' },
] as const
let sequence = 0
const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

function showError(e: unknown) {
  error.value = message(e)
  if (e instanceof ApiError && e.status === 401) {
    authed.value = false
    result.value = null
  }
}

async function load() {
  const id = ++sequence
  loading.value = true
  error.value = ''
  result.value = null
  try {
    const data = await api.comments(status.value, offset.value)
    if (id === sequence) result.value = data
  } catch (e) {
    if (id === sequence) showError(e)
  } finally {
    if (id === sequence) loading.value = false
  }
}
async function connect() {
  busy.value = true
  error.value = ''
  try {
    const session = await api.commentLogin(site.value, password.value)
    authed.value = session.authed
    site.value = session.site
    password.value = ''
    offset.value = 0
    await load()
  } catch (e) {
    showError(e)
  } finally {
    busy.value = false
  }
}
async function logout() {
  ++sequence
  busy.value = true
  try {
    await api.commentLogout()
  } catch (e) {
    error.value = message(e)
  } finally {
    authed.value = false
    result.value = null
    busy.value = false
    loading.value = false
  }
}
async function act(id: string, action: 'hide' | 'restore' | 'purge') {
  if (
    action === 'purge' &&
    !(await confirmAction({
      title: '永久删除评论',
      content: '此评论及其回复将永久删除，无法恢复。',
      confirmText: '删除',
      danger: true,
    }))
  )
    return
  busy.value = true
  error.value = ''
  try {
    await api.commentAction(id, action)
    if (result.value?.comments.length === 1 && offset.value > 0) offset.value -= 50
    await load()
  } catch (e) {
    showError(e)
  } finally {
    busy.value = false
  }
}
async function filter(value: typeof status.value) {
  status.value = value
  offset.value = 0
  await load()
}
async function paginate(value: number) {
  offset.value = value
  await load()
}
onMounted(async () => {
  try {
    const session = await api.commentSession()
    site.value = session.site
    authed.value = session.authed
    if (session.authed) await load()
  } catch (e) {
    error.value = message(e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <section class="space-y-5">
    <UiAlert v-if="error" :message="error" />
    <UiLoading v-if="loading">正在读取评论</UiLoading>
    <form v-else-if="!authed" class="max-w-md space-y-5" @submit.prevent="connect">
      <label class="block space-y-2"
        ><span class="text-sm">站点地址</span
        ><UiInput v-model="site" type="url" required placeholder="https://example.com"
      /></label>
      <label class="block space-y-2"
        ><span class="text-sm">管理密码</span
        ><UiInput v-model="password" type="password" autocomplete="current-password" required
      /></label>
      <UiButton type="submit" variant="primary" :loading="busy">登录</UiButton>
    </form>
    <template v-if="authed">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex gap-2" aria-label="评论状态">
          <UiButton
            v-for="tab in tabs"
            :key="tab.value"
            :variant="status === tab.value ? 'primary' : 'default'"
            :aria-pressed="status === tab.value"
            :disabled="busy || loading"
            @click="filter(tab.value)"
            >{{ tab.label }}</UiButton
          >
        </div>
        <div class="flex gap-2">
          <UiButton :disabled="loading || busy" @click="load">刷新</UiButton
          ><UiButton :disabled="loading || busy" @click="logout">退出登录</UiButton>
        </div>
      </div>
      <p v-if="result" class="text-sm text-panel-muted tabular-nums">
        共 {{ result.summary.total }} 条 · 显示中 {{ result.summary.visible }} · 已隐藏
        {{ result.summary.hidden }}
      </p>
      <p v-if="result && !result.comments.length" class="py-8 text-panel-muted">暂无评论</p>
      <ul v-if="result" class="space-y-3">
        <li
          v-for="comment in result.comments"
          :key="comment.id"
          class="rounded-sm border border-panel-line bg-panel p-5"
        >
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-panel-muted">
            <span class="font-medium text-panel-text">{{ comment.author }}</span>
            <span v-if="comment.hidden">已隐藏</span><span v-if="comment.parentId">回复</span>
            <a
              v-if="comment.path"
              :href="`${site}${comment.path}#comments`"
              target="_blank"
              rel="noopener noreferrer"
              class="break-all hover:text-interactive"
              >{{ comment.path }}</a
            >
            <time :datetime="new Date(comment.createdAt).toISOString()" class="tabular-nums">{{
              new Date(comment.createdAt).toLocaleString('zh-CN')
            }}</time>
          </div>
          <p class="mt-3 text-base leading-relaxed break-words whitespace-pre-wrap">
            {{ comment.body }}
          </p>
          <div class="mt-4 flex gap-2">
            <UiButton
              :disabled="busy"
              @click="act(comment.id, comment.hidden ? 'restore' : 'hide')"
              >{{ comment.hidden ? '恢复' : '隐藏' }}</UiButton
            >
            <UiButton variant="danger" :disabled="busy" @click="act(comment.id, 'purge')"
              >永久删除</UiButton
            >
          </div>
        </li>
      </ul>
      <div v-if="result && (total ?? 0) > 50" class="flex items-center justify-end gap-3">
        <UiButton :disabled="busy || loading || offset === 0" @click="paginate(offset - 50)"
          >上一页</UiButton
        >
        <span class="text-sm tabular-nums"
          >{{ offset / 50 + 1 }} / {{ Math.ceil((total ?? 0) / 50) }}</span
        >
        <UiButton
          :disabled="busy || loading || offset + 50 >= (total ?? 0)"
          @click="paginate(offset + 50)"
          >下一页</UiButton
        >
      </div>
    </template>
  </section>
</template>
