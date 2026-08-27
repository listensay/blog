<script setup lang="ts">
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons-vue'

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
  <a-spin :spinning="loading">
    <a-alert v-if="loadError" type="error" show-icon :message="loadError" class="banner" />

    <div class="head">
      <span class="head-title">{{ title }}</span>
      <a-tag v-if="dirty" color="orange">未保存</a-tag>

      <span class="spacer" />

      <a-button :loading="loading" @click="emit('reload')">
        <template #icon><ReloadOutlined /></template>
        刷新
      </a-button>

      <a-button type="primary" :loading="saving" :disabled="!canSave" @click="emit('save')">
        <template #icon><SaveOutlined /></template>
        保存 ⌘S
      </a-button>
    </div>

    <a-alert
      v-if="fileMissing"
      type="warning"
      show-icon
      class="banner"
      message="文件不存在"
      description="保存后自动创建。"
    />

    <a-alert
      v-else-if="fileError"
      type="error"
      show-icon
      class="banner"
      message="文件解析失败，当前为默认值"
      :description="`${fileError}。保存将覆盖该文件。`"
    />

    <slot />
  </a-spin>
</template>

<style scoped>
.banner {
  margin-bottom: 16px;
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.head-title {
  font-weight: 600;
}

.spacer {
  flex: 1;
}
</style>
