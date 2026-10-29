<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import UiAlert from '@/components/ui/UiAlert.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiIcon from '@/components/ui/UiIcon.vue'
import UiLoading from '@/components/ui/UiLoading.vue'

const route = useRoute()
const frame = ref<HTMLIFrameElement>()
const ready = ref(false)
const loading = ref(true)
const error = ref('')
const attempt = ref(0)
const source = computed(
  () =>
    `/affine-workspace/${typeof route.query.file === 'string' ? `?file=${encodeURIComponent(route.query.file)}` : ''}`,
)
async function check() {
  attempt.value++
  loading.value = true
  error.value = ''
  try {
    const response = await fetch('/api/affine')
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || '工作区未能打开')
    ready.value = result.ready
    if (!ready.value) error.value = '工作区尚未构建，请在项目根目录运行 npm run affine:build。'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}
function receive(event: MessageEvent) {
  if (event.origin !== location.origin || event.source !== frame.value?.contentWindow) return
  if (event.data?.type === 'blog-workspace-error') error.value = event.data.error
}
onMounted(() => {
  void check()
  window.addEventListener('message', receive)
})
onBeforeUnmount(() => window.removeEventListener('message', receive))
onBeforeRouteLeave(async () => {
  const child = frame.value?.contentWindow as
    (Window & { __BLOG_LOCAL_NOTES_FLUSH__?: () => Promise<void> }) | undefined
  try {
    await child?.__BLOG_LOCAL_NOTES_FLUSH__?.()
    return true
  } catch {
    error.value = '文档尚未保存成功，请稍后再切换。'
    return false
  }
})
</script>

<template>
  <section class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <header
      class="flex min-h-20 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-panel-line px-5 py-4 md:px-8"
    >
      <h1 class="text-2xl font-bold tracking-tight">Blog管理</h1>
      <div class="flex flex-wrap gap-2">
        <UiButton v-if="error" icon="refresh" :loading="loading" @click="check">重试</UiButton
        ><a
          :href="source"
          target="_blank"
          rel="noopener"
          class="inline-flex min-h-11 items-center gap-2 rounded-sm border border-panel-line bg-panel-raised px-3 py-2 text-sm hover:border-panel-muted"
          ><UiIcon name="external" />独立窗口</a
        >
      </div>
    </header>
    <UiAlert v-if="error" :message="error" class="m-5" />
    <UiLoading v-if="loading">正在打开 AFFiNE</UiLoading>
    <iframe
      v-if="ready"
      :key="attempt"
      ref="frame"
      :src="source"
      title="AFFiNE 博客内容"
      allow="clipboard-read; clipboard-write; fullscreen"
      class="block min-h-0 w-full flex-1 border-0"
    />
  </section>
</template>
