<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { confirmAction, notify } from '@/composables/useFeedback'

import { api } from '@/api'
import UiAlert from '@/components/ui/UiAlert.vue'
import SettingsShell from '@/components/SettingsShell.vue'
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
    notify.success('已保存')
  } catch (err) {
    notify.error(err instanceof Error ? err.message : String(err))
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
  return confirmAction({
    title: '有未保存的修改',
    content: '离开后修改会丢失。',
    confirmText: '不保存并离开',
    danger: true,
  })
})
</script>

<template>
  <SettingsShell
    title="友情链接"
    :loading="loading"
    :saving="saving"
    :dirty="dirty"
    :can-save="savable"
    :load-error="loadError"
    :file-error="''"
    :file-missing="false"
    @reload="load"
    @save="save"
  >
    <UiAlert
      v-if="missing"
      tone="warning"
      message="页面不存在"
      description="请在 AFFiNE 中创建 slug 为 links 的页面并同步。"
    />
    <section v-else class="rounded-sm border border-panel-line bg-panel p-5">
      <FriendLinksEditor v-model="friends" />
      <p v-if="friends.length" class="mt-4 text-xs tabular-nums text-panel-muted">
        共 {{ friends.length }} 条
      </p>
    </section>
  </SettingsShell>
</template>
