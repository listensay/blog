<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { api } from '@/api'
import { registerDesktopSync } from '@/desktop'
import type { GitSyncStatus } from '@/types'
import UiButton from './ui/UiButton.vue'

const status = ref<GitSyncStatus>()
const error = ref('')
const retrying = ref(false)
const labels = {
  idle: '',
  pending: '等待推送',
  committing: '正在提交',
  pushing: '正在推送',
  synced: '已推送',
  error: '推送失败',
}
let source: EventSource | undefined
let disposed = false
let revision = 0

async function refresh() {
  const start = revision
  try {
    const value = await api.gitStatus()
    if (!disposed && start === revision) {
      status.value = value
      error.value = ''
    }
  } catch (cause) {
    if (!disposed && start === revision)
      error.value = cause instanceof Error ? cause.message : '无法读取推送状态'
  }
}
async function retry() {
  retrying.value = true
  try {
    status.value = await api.gitFlush()
    error.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '推送失败'
  } finally {
    retrying.value = false
  }
}
const unregister = registerDesktopSync(() => api.gitFlush())
onMounted(() => {
  source = new EventSource('/api/events')
  source.onopen = () => {
    void refresh()
  }
  source.onerror = () => {
    error.value = '同步状态连接已中断，正在重新连接。'
  }
  source.addEventListener('git-sync', (event) => {
    revision++
    status.value = JSON.parse((event as MessageEvent).data) as GitSyncStatus
    error.value = ''
  })
  void refresh()
})
onBeforeUnmount(() => {
  disposed = true
  source?.close()
  unregister()
})
</script>

<template>
  <div
    v-if="error || (status && status.phase !== 'idle')"
    class="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 border-b border-panel-line bg-panel px-5 py-2 text-sm md:px-8"
    :class="error || status?.phase === 'error' ? 'text-danger' : 'text-panel-muted'"
  >
    <p :role="error || status?.phase === 'error' ? 'alert' : 'status'" aria-live="polite">
      {{ error || status?.error || (status && labels[status.phase]) }}
    </p>
    <UiButton
      v-if="error || status?.phase === 'error'"
      icon="refresh"
      :loading="retrying"
      @click="retry"
      >重试</UiButton
    >
  </div>
</template>
