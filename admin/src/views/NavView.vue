<script setup lang="ts">
import { computed, ref } from 'vue'
import { api } from '@/api'
import { useAutoSave } from '@/composables/useAutoSave'
import { useDataRefresh } from '@/composables/useDataRefresh'
import SettingsShell from '@/components/SettingsShell.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiRowActions from '@/components/ui/UiRowActions.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import NavIcon from '@/components/NavIcon.vue'
import type { NavIconOption, NavItem } from '@/types'

const items = ref<NavItem[]>([])
const icons = ref<NavIconOption[]>([])
const pagePaths = ref<string[]>([])
const fileError = ref('')
const fileMissing = ref(false)
const state = useAutoSave({
  value: items,
  enabled: () => !fileError.value,
  read: async () => {
    const nav = await api.getNav()
    icons.value = nav.icons
    fileMissing.value = nav.missing === true
    fileError.value = nav.error ?? ''
    try {
      pagePaths.value = (await api.listPages()).pages.map((page) => page.path)
    } catch {
      // Path suggestions are optional; retain the last successful catalog.
    }
    return nav.items
  },
  write: async (value) => (await api.saveNav(value)).items,
})
const { loading, saving, dirty, saved, loadError, saveError, refreshError } = state
useDataRefresh(state.refresh)
async function retry() {
  if (dirty.value) await state.flush()
  else await state.refresh()
}

const BUILTIN_PATHS = ['/', '/blog', '/journals', '/projects', '/categories', '/tags'] as const
const pathOptions = computed(() => [
  ...BUILTIN_PATHS.map((value) => ({ value })),
  ...pagePaths.value.map((value) => ({ value })),
])
const DEFAULT_COLOR = '#f4d47b'

function update(index: number, patch: Partial<NavItem>) {
  items.value = items.value.map((item, i) => (i === index ? { ...item, ...patch } : item))
}

function add() {
  items.value = [...items.value, { label: '', to: '', icon: 'page', color: DEFAULT_COLOR }]
}

function remove(index: number) {
  items.value = items.value.filter((_, i) => i !== index)
}

function move(index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= items.value.length) return
  const next = [...items.value]
  const a = next[index]!
  const b = next[target]!
  next[index] = b
  next[target] = a
  items.value = next
}

function looksMissing(to: string): boolean {
  if (!to.startsWith('/') || to === '/') return false
  if ((BUILTIN_PATHS as readonly string[]).includes(to)) return false
  if (pagePaths.value.includes(to)) return false
  return to.split('/').filter(Boolean).length === 1 && pagePaths.value.length > 0
}

const duplicated = computed(() => {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const item of items.value) {
    if (seen.has(item.to)) dupes.add(item.to)
    seen.add(item.to)
  }
  return dupes
})
</script>

<template>
  <SettingsShell
    title="菜单"
    :loading="loading"
    :saving="saving"
    :dirty="dirty"
    :saved="saved"
    :save-error="saveError"
    :refresh-error="refreshError"
    :blocked="!!fileError"
    :load-error="loadError"
    :file-error="fileError"
    :file-missing="fileMissing"
    @retry="retry"
  >
    <section class="rounded-sm border border-panel-line bg-panel p-5">
      <h2 class="mb-4 text-lg font-semibold">预览</h2>
      <nav aria-label="菜单预览" class="flex flex-wrap gap-3 rounded-sm bg-panel-raised p-4">
        <span
          v-for="(item, index) in items"
          :key="index"
          class="inline-flex items-center gap-2 px-2 py-1 text-sm"
          ><NavIcon :name="item.icon" :size="18" :style="{ color: item.color }" />{{
            item.label.trim() || '未命名'
          }}</span
        >
        <span v-if="!items.length" class="text-sm text-panel-muted">暂无菜单项</span>
      </nav>
    </section>
    <section class="rounded-sm border border-panel-line bg-panel p-5">
      <h2 class="mb-4 text-lg font-semibold">菜单项</h2>
      <div
        v-for="(item, index) in items"
        :key="index"
        class="flex flex-wrap items-start gap-3 border-b border-panel-line py-5 first:pt-0"
      >
        <span class="w-5 shrink-0 pt-9 text-sm tabular-nums text-panel-muted">{{ index + 1 }}</span>
        <div
          class="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1.4fr_180px_60px]"
        >
          <label class="flex min-w-0 flex-col gap-2 text-sm text-panel-muted"
            >名称<UiInput
              :model-value="item.label"
              placeholder="首页"
              :maxlength="24"
              @update:model-value="update(index, { label: $event })"
          /></label>
          <label class="flex min-w-0 flex-col gap-2 text-sm text-panel-muted"
            >路径<UiInput
              :model-value="item.to"
              list="menu-paths"
              class="font-mono"
              placeholder="/about"
              :aria-invalid="duplicated.has(item.to) || undefined"
              @update:model-value="update(index, { to: $event })"
            /><span v-if="duplicated.has(item.to)" class="text-xs text-danger"
              >与其他菜单项路径重复</span
            ><span v-else-if="looksMissing(item.to)" class="text-xs text-warning-ink"
              >页面不存在，请检查路径</span
            ></label
          >
          <div class="space-y-2">
            <span class="block text-sm text-panel-muted">图标</span
            ><UiSelect
              :model-value="item.icon"
              :options="icons"
              label="菜单图标"
              @update:model-value="update(index, { icon: $event })"
              ><template #icon><NavIcon :name="item.icon" /></template
              ><template #option="{ option }"
                ><NavIcon :name="option.value" />{{ option.label }}</template
              ></UiSelect
            >
          </div>
          <label class="flex flex-col gap-2 text-sm text-panel-muted"
            >颜色<UiInput
              type="color"
              :model-value="item.color"
              class="h-11 cursor-pointer px-1"
              @update:model-value="update(index, { color: $event })"
          /></label>
        </div>
        <UiRowActions
          class="ml-auto sm:pt-7"
          :first="index === 0"
          :last="index === items.length - 1"
          :label="item.label"
          @move="move(index, $event)"
          @remove="remove(index)"
        />
      </div>
      <UiButton icon="plus" class="mt-5 w-full" @click="add">添加菜单项</UiButton>
      <datalist id="menu-paths">
        <option v-for="option in pathOptions" :key="option.value" :value="option.value" />
      </datalist>
    </section>
  </SettingsShell>
</template>
