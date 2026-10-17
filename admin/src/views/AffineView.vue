<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import { ExportOutlined, ReloadOutlined } from '@ant-design/icons-vue'

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
  <section class="workspace">
    <header class="workspace-bar">
      <div><strong>AFFiNE 工作区</strong><span>文档自动保存 · 文章与页面在编辑器内发布</span></div>
      <a-space>
        <a-button v-if="error" @click="check"
          ><template #icon><ReloadOutlined /></template>重试</a-button
        >
        <a-button :href="source" target="_blank" rel="noopener"
          ><template #icon><ExportOutlined /></template>独立窗口</a-button
        >
      </a-space>
    </header>
    <a-alert v-if="error" type="error" show-icon :message="error" />
    <div v-if="loading" class="loading"><a-spin tip="正在打开工作区…" /></div>
    <iframe
      v-if="ready"
      :key="attempt"
      ref="frame"
      :src="source"
      title="AFFiNE 博客工作区"
      allow="clipboard-read; clipboard-write; fullscreen"
    />
  </section>
</template>
<style scoped>
.workspace {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: white;
}
.workspace-bar {
  min-height: 56px;
  padding: 10px 18px;
  border-bottom: 1px solid #eee;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.workspace-bar strong {
  font-size: 14px;
}
.workspace-bar span {
  margin-left: 16px;
  font-size: 12px;
  color: #888;
}
iframe {
  border: 0;
  width: 100%;
  flex: 1;
  min-height: 0;
}
.loading {
  padding: 80px;
  text-align: center;
}
@media (max-width: 1100px) {
  .workspace-bar span {
    display: none;
  }
}
</style>
