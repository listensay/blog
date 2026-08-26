<script setup lang="ts">
import type { AdminCommentsResponse } from '~/types/blog'

useSeo({
  title: '评论管理',
  noindex: true,
})

type Screen = 'loading' | 'disabled' | 'guest' | 'ready'

const screen = ref<Screen>('loading')
const password = ref('')
const filter = ref<'all' | 'visible' | 'hidden'>('all')
const list = ref<AdminCommentsResponse | null>(null)
const busy = ref(false)
const error = ref('')

async function loadComments() {
  error.value = ''
  try {
    list.value = await $fetch<AdminCommentsResponse>('/api/admin/comments', {
      query: { status: filter.value, limit: 200 },
    })
  }
  catch (e) {
    screen.value = 'guest'
    error.value = apiErrorMessage(e, '读取评论失败')
  }
}

async function loadSession() {
  try {
    const session = await $fetch<{ enabled: boolean, authed: boolean }>('/api/admin/session')
    screen.value = !session.enabled ? 'disabled' : session.authed ? 'ready' : 'guest'
    if (screen.value === 'ready') await loadComments()
  }
  catch (e) {
    screen.value = 'guest'
    error.value = apiErrorMessage(e, '无法连接后台')
  }
}

onMounted(loadSession)

watch(filter, () => {
  if (screen.value === 'ready') loadComments()
})

async function login() {
  if (busy.value || !password.value) return
  busy.value = true
  error.value = ''
  try {
    await $fetch('/api/admin/login', { method: 'POST', body: { password: password.value } })
    password.value = ''
    screen.value = 'ready'
    await loadComments()
  }
  catch (e) {
    error.value = apiErrorMessage(e, '登录失败')
  }
  finally {
    busy.value = false
  }
}

async function logout() {
  await $fetch('/api/admin/logout', { method: 'POST' }).catch(() => {})
  list.value = null
  screen.value = 'guest'
}

async function act(run: () => Promise<unknown>) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await run()
    await loadComments()
  }
  catch (e) {
    error.value = apiErrorMessage(e, '操作失败')
  }
  finally {
    busy.value = false
  }
}

const hide = (id: string) => act(() => $fetch(`/api/admin/comments/${id}`, { method: 'DELETE' }))
const restore = (id: string) => act(() => $fetch(`/api/admin/comments/${id}/restore`, { method: 'POST' }))

function purge(id: string) {
  if (!window.confirm('彻底删除后无法恢复，同时会删掉它下面的回复。继续？')) return
  return act(() => $fetch(`/api/admin/comments/${id}`, { method: 'DELETE', query: { purge: 1 } }))
}

const tabs = [
  { value: 'all', label: '全部' },
  { value: 'visible', label: '显示中' },
  { value: 'hidden', label: '已隐藏' },
] as const
</script>

<template>
  <div class="py-8 sm:py-16">
    <h1 class="text-2xl font-bold tracking-tight text-slate-900">
      评论管理
    </h1>

    <p v-if="screen === 'loading'" class="mt-6 text-sm text-slate-400">
      正在检查登录状态…
    </p>

    <div v-else-if="screen === 'disabled'" class="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
      <p class="font-medium">
        后台还没启用
      </p>
      <p class="mt-2 leading-relaxed">
        需要先设置管理密码和签名密钥。线上（Cloudflare）执行：
      </p>
      <pre class="mt-2 overflow-x-auto rounded-lg bg-amber-900/5 p-3 text-xs leading-relaxed">npx wrangler secret put NUXT_ADMIN_PASSWORD
npx wrangler secret put NUXT_SESSION_SECRET
npx wrangler secret put NUXT_VISITOR_SALT</pre>
      <p class="mt-2 leading-relaxed">
        本地开发则写进项目根目录的 <code class="rounded bg-amber-900/5 px-1">.env</code>（已被 git 忽略）。
      </p>
    </div>

    <form v-else-if="screen === 'guest'" class="mt-6 max-w-sm" @submit.prevent="login">
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-500">管理密码</span>
        <input
          v-model="password"
          type="password"
          autocomplete="current-password"
          class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-colors focus:border-brand-400 focus:outline-none"
        >
      </label>
      <button
        type="submit"
        :disabled="busy || !password"
        class="mt-3 w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:bg-slate-300"
      >
        {{ busy ? '登录中…' : '登录' }}
      </button>
      <p v-if="error" class="mt-2 text-xs text-red-500">
        {{ error }}
      </p>
    </form>

    <template v-else>
      <div class="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div class="flex gap-1.5">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            type="button"
            class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            :class="filter === tab.value
              ? 'bg-brand-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700'"
            @click="filter = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="flex items-center gap-3 text-xs text-slate-400">
          <span v-if="list">
            共 {{ list.summary.total }} 条 · 显示中 {{ list.summary.visible }} · 已隐藏 {{ list.summary.hidden }}
          </span>
          <button type="button" class="transition-colors hover:text-brand-600" @click="loadComments()">
            刷新
          </button>
          <button type="button" class="transition-colors hover:text-red-500" @click="logout">
            退出登录
          </button>
        </div>
      </div>

      <p v-if="error" class="mt-3 text-xs text-red-500">
        {{ error }}
      </p>

      <p v-if="list && !list.comments.length" class="mt-8 text-sm text-slate-400">
        这个筛选下没有评论。
      </p>

      <ul v-else-if="list" class="mt-6 space-y-3">
        <li
          v-for="comment in list.comments"
          :key="comment.id"
          class="rounded-xl border p-4 transition-colors"
          :class="comment.hidden ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'"
        >
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
            <span class="text-sm font-medium text-slate-900">{{ comment.author }}</span>
            <span v-if="comment.hidden" class="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600">已隐藏</span>
            <span v-if="comment.parentId" class="rounded bg-slate-100 px-1.5 py-0.5 text-[11px]">回复</span>
            <NuxtLink :to="`/blog/${comment.slug}#comments`" class="hover:text-brand-600">
              /blog/{{ comment.slug }}
            </NuxtLink>
            <time :datetime="isoDateTime(comment.createdAt)">{{ localDateTime(comment.createdAt) }}</time>
            <span class="font-mono">{{ comment.visitor }}</span>
            <a
              v-if="comment.website"
              :href="comment.website"
              target="_blank"
              rel="nofollow noopener noreferrer"
              class="truncate hover:text-brand-600"
            >{{ comment.website }}</a>
          </div>

          <p class="mt-2 text-sm leading-relaxed whitespace-pre-wrap break-words text-slate-700">
            {{ comment.body }}
          </p>

          <div class="mt-3 flex gap-3 text-xs">
            <button
              v-if="!comment.hidden"
              type="button"
              :disabled="busy"
              class="text-slate-500 transition-colors hover:text-amber-600 disabled:opacity-50"
              @click="hide(comment.id)"
            >
              隐藏
            </button>
            <button
              v-else
              type="button"
              :disabled="busy"
              class="text-slate-500 transition-colors hover:text-brand-600 disabled:opacity-50"
              @click="restore(comment.id)"
            >
              恢复
            </button>
            <button
              type="button"
              :disabled="busy"
              class="text-slate-400 transition-colors hover:text-red-500 disabled:opacity-50"
              @click="purge(comment.id)"
            >
              彻底删除
            </button>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>
