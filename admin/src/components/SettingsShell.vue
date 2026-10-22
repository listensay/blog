<script setup lang="ts">
import UiAlert from './ui/UiAlert.vue'
import UiButton from './ui/UiButton.vue'
import UiLoading from './ui/UiLoading.vue'
defineProps<{
  title: string
  loading: boolean
  saving: boolean
  dirty: boolean
  canSave: boolean
  loadError: string
  fileError: string
  fileMissing: boolean
}>()
const emit = defineEmits<{ reload: []; save: [] }>()
</script>
<template>
  <section :aria-label="title" :aria-busy="loading || saving">
    <div class="mb-6 flex flex-wrap items-center justify-end gap-2">
      <span
        v-if="dirty && !loading"
        class="mr-auto rounded-xs bg-accent/25 px-2 py-1 text-xs text-warning-ink"
        >未保存</span
      >
      <UiButton icon="refresh" :loading="loading" :disabled="saving" @click="emit('reload')"
        >刷新</UiButton
      >
      <UiButton
        variant="primary"
        icon="save"
        :loading="saving"
        :disabled="!canSave"
        aria-keyshortcuts="Meta+S Control+S"
        @click="emit('save')"
        >保存</UiButton
      >
    </div>
    <UiAlert v-if="loadError" class="mb-5" :message="loadError" />
    <UiLoading v-if="loading" />
    <template v-else-if="!loadError">
      <UiAlert
        v-if="fileMissing"
        tone="warning"
        class="mb-5"
        message="文件不存在"
        description="保存后自动创建。"
      />
      <UiAlert
        v-else-if="fileError"
        class="mb-5"
        message="文件解析失败"
        :description="`${fileError}。保存将覆盖该文件。`"
      />
      <fieldset :disabled="saving" class="min-w-0 space-y-6 border-0 p-0"><slot /></fieldset>
    </template>
  </section>
</template>
