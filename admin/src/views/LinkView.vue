<script setup lang="ts">
import { ref } from 'vue'
import { api } from '@/api'
import { useAutoSave } from '@/composables/useAutoSave'
import { useDataRefresh } from '@/composables/useDataRefresh'
import UiAlert from '@/components/ui/UiAlert.vue'
import SettingsShell from '@/components/SettingsShell.vue'
import FriendLinksEditor from '@/components/FriendLinksEditor.vue'
import type { FriendLink } from '@/types'

const missing = ref(false)
const friends = ref<FriendLink[]>([])
const state = useAutoSave({
  value: friends,
  enabled: () => !missing.value,
  read: async () => {
    try {
      const detail = await api.getLinks()
      missing.value = false
      return detail.friends
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('不存在')) throw error
      missing.value = true
      return []
    }
  },
  write: async (value) => (await api.saveLinks(value)).friends,
})
const { loading, saving, dirty, saved, loadError, saveError, refreshError } = state
useDataRefresh(state.refresh)
async function retry() {
  if (dirty.value) await state.flush()
  else await state.refresh()
}
</script>

<template>
  <SettingsShell
    title="友情链接"
    :loading="loading"
    :saving="saving"
    :dirty="dirty"
    :saved="saved && !missing"
    :save-error="saveError"
    :refresh-error="refreshError"
    :load-error="loadError"
    :file-error="''"
    :file-missing="false"
    @retry="retry"
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
