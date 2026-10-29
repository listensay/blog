<script setup lang="ts">
import UiAlert from './ui/UiAlert.vue'
import UiButton from './ui/UiButton.vue'
import UiLoading from './ui/UiLoading.vue'
defineProps<{
  title: string
  loading: boolean
  saving: boolean
  dirty: boolean
  saved: boolean
  saveError: string
  refreshError: string
  blocked?: boolean
  loadError: string
  fileError: string
  fileMissing: boolean
}>()
const emit = defineEmits<{ retry: [] }>()
</script>
<template>
  <section :aria-label="title" :aria-busy="loading || saving">
    <p
      v-if="!loading && !saveError && (dirty || saving || (saved && !fileMissing && !fileError))"
      role="status"
      aria-live="polite"
      class="mb-5 text-sm text-panel-muted"
    >
      {{ saving ? '保存中…' : dirty ? '待保存' : '已保存' }}
    </p>
    <UiAlert
      v-if="loadError || saveError || refreshError"
      class="mb-5"
      :message="loadError || saveError || refreshError"
    >
      <UiButton class="mt-3" :loading="loading || saving" @click="emit('retry')">重试</UiButton>
    </UiAlert>
    <UiLoading v-if="loading" />
    <template v-else-if="!loadError">
      <UiAlert
        v-if="fileMissing"
        tone="warning"
        class="mb-5"
        message="文件不存在"
        description="修改后自动创建。"
      />
      <UiAlert v-else-if="fileError" class="mb-5" message="文件解析失败" :description="fileError" />
      <fieldset :disabled="blocked" class="min-w-0 space-y-6 border-0 p-0"><slot /></fieldset>
    </template>
  </section>
</template>
