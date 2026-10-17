<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons-vue'

import { api } from '@/api'
import FriendLinksEditor from '@/components/FriendLinksEditor.vue'
import type { FriendLink, PageDetail } from '@/types'

const loading = ref(true)
const saving = ref(false)
const loadError = ref('')
const missing = ref(false)

const friends = ref<FriendLink[]>([])

function snapshot(): string {
  const text = (value: string | null | undefined) => value ?? ''
  return JSON.stringify(
    friends.value.map((item) => [
      text(item.name),
      text(item.url),
      text(item.description),
      text(item.avatar),
    ]),
  )
}

const baseline = ref(snapshot())
const dirty = computed(() => snapshot() !== baseline.value)

const savable = computed(() => !loading.value && !missing.value && !loadError.value)

async function load() {
  loading.value = true
  loadError.value = ''
  missing.value = false

  try {
    fill(await api.getLinks())
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err)
    if (text.includes('不存在')) {
      missing.value = true
      friends.value = []
      baseline.value = snapshot()
    } else {
      loadError.value = text
    }
  } finally {
    loading.value = false
  }
}

function fill(detail: PageDetail) {
  friends.value = detail.friends.map((item) => ({ ...item }))
  baseline.value = snapshot()
}

onMounted(() => {
  void load()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('beforeunload', onBeforeUnload)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('beforeunload', onBeforeUnload)
})

async function save() {
  if (saving.value || !savable.value) return

  saving.value = true
  try {
    fill(await api.saveLinks(friends.value))
    message.success('已保存')
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  } finally {
    saving.value = false
  }
}

function onKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    void save()
  }
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value) event.preventDefault()
}

onBeforeRouteLeave(async () => {
  if (!dirty.value) return true
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: '有未保存的修改',
      content: '离开后修改会丢失。',
      okText: '不保存并离开',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
})
</script>

<template>
  <a-spin :spinning="loading">
    <a-alert v-if="loadError" type="error" show-icon :message="loadError" class="banner" />

    <div class="head">
      <span class="head-title">友情链接</span>
      <a-tag v-if="dirty" color="orange">未保存</a-tag>

      <span class="spacer" />

      <a-button :loading="loading" @click="load">
        <template #icon><ReloadOutlined /></template>
        刷新
      </a-button>

      <a-button type="primary" :loading="saving" :disabled="!savable" @click="save">
        <template #icon><SaveOutlined /></template>
        保存 ⌘S
      </a-button>
    </div>

    <a-alert
      v-if="missing"
      type="warning"
      show-icon
      class="banner"
      message="页面不存在"
      description="请在 AFFiNE 中创建 slug 为 links 的页面并同步。"
    />

    <div class="card">
      <FriendLinksEditor v-model="friends" />
      <div class="count">共 {{ friends.length }} 条</div>
    </div>
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

.card {
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

.count {
  margin-top: 12px;
  color: #bfbfbf;
  font-size: 12px;
}
</style>
