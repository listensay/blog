<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import {
  DeleteOutlined,
  DownOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  UpOutlined,
} from '@ant-design/icons-vue'

import { api } from '@/api'
import type { NavIconOption, NavItem, PageSummary } from '@/types'

const loading = ref(true)
const saving = ref(false)
const loadError = ref('')
const fileError = ref('')
const fileMissing = ref(false)
const filePath = ref('content/data/nav.json')

const items = ref<NavItem[]>([])
const icons = ref<NavIconOption[]>([])

const baseline = ref('[]')
const dirty = computed(() => JSON.stringify(items.value) !== baseline.value)

const pagePaths = ref<string[]>([])

const BUILTIN_PATHS = ['/', '/blog', '/categories', '/tags'] as const

const pathOptions = computed(() => [
  ...BUILTIN_PATHS.map((value) => ({ value })),
  ...pagePaths.value.map((value) => ({ value })),
])

const DEFAULT_COLOR = '#3b82f6'

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const nav = await api.getNav()
    items.value = nav.items.map((item) => ({ ...item }))
    icons.value = nav.icons
    filePath.value = nav.file
    fileMissing.value = nav.missing === true
    fileError.value = nav.error ?? ''
    baseline.value = JSON.stringify(items.value)
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }

  try {
    pagePaths.value = (await api.listPages()).pages.map((page: PageSummary) => page.path)
  } catch {
    pagePaths.value = []
  }
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
      title: '菜单还没保存',
      content: '改动会丢掉，确定离开吗？',
      okText: '不保存，离开',
      okType: 'danger',
      cancelText: '留下继续改',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
})

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

async function save() {
  if (saving.value) return
  saving.value = true
  try {
    const nav = await api.saveNav(items.value)
    items.value = nav.items.map((item) => ({ ...item }))
    baseline.value = JSON.stringify(items.value)
    fileMissing.value = false
    fileError.value = ''
    message.success(`已存进 ${nav.file}`)
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  } finally {
    saving.value = false
  }
}

const iconLabel = (value: string) =>
  icons.value.find((item) => item.value === value)?.label ?? value
</script>

<template>
  <a-spin :spinning="loading">
    <a-alert v-if="loadError" type="error" show-icon :message="loadError" class="banner" />

    <div class="head">
      <span class="head-title">顶部菜单</span>
      <span class="mono head-file">{{ filePath }}</span>
      <a-tag v-if="dirty" color="orange">未保存</a-tag>

      <span class="spacer" />

      <a-button :loading="loading" @click="load">
        <template #icon><ReloadOutlined /></template>
        重新读取
      </a-button>

      <a-button type="primary" :loading="saving" @click="save">
        <template #icon><SaveOutlined /></template>
        保存 ⌘S
      </a-button>
    </div>

    <a-alert
      v-if="fileMissing"
      type="warning"
      show-icon
      class="banner"
      message="还没有这个文件"
      :description="`${filePath} 不存在，保存一次就会建出来。`"
    />

    <a-alert
      v-else-if="fileError"
      type="error"
      show-icon
      class="banner"
      message="这个文件读不动，界面上显示的是空菜单"
      :description="`${fileError}。保存一次会用这里的内容覆盖它 —— 覆盖之前先确认下面列的就是你想要的。`"
    />

    <div class="card">
      <div class="card-title">预览</div>
      <nav class="preview">
        <span v-for="(item, index) in items" :key="index" class="preview-item">
          <span class="preview-dot" :style="{ background: item.color }" />
          {{ item.label || '（没写文字）' }}
          <span class="preview-icon">{{ iconLabel(item.icon) }}</span>
        </span>
        <span v-if="!items.length" class="muted">一项都没有，顶栏会是空的。</span>
      </nav>
    </div>

    <div class="card">
      <div class="card-title">菜单项</div>

      <div v-for="(item, index) in items" :key="index" class="row">
        <span class="index mono">{{ index + 1 }}</span>

        <div class="fields">
          <a-input
            :value="item.label"
            class="label-input"
            placeholder="显示的文字，如 About"
            @update:value="(v: string) => update(index, { label: v })"
          />

          <div class="to-field">
            <a-auto-complete
              :value="item.to"
              class="mono-input"
              placeholder="/about"
              :options="pathOptions"
              @update:value="(v: unknown) => update(index, { to: String(v ?? '') })"
            />
            <div v-if="duplicated.has(item.to)" class="field-error">
              和另一项指向同一个地址，选中状态会同时亮两个
            </div>
            <div v-else-if="looksMissing(item.to)" class="field-warn">
              没有这个页面 —— 去「页面」里建一个，或者检查是不是写错了
            </div>
          </div>

          <a-select
            :value="item.icon"
            class="icon-select"
            :options="icons"
            :field-names="{ label: 'label', value: 'value' }"
            show-search
            option-filter-prop="label"
            @update:value="(v: unknown) => update(index, { icon: String(v) })"
          />

          <a-input
            :value="item.color"
            class="color-input mono-input"
            type="color"
            @update:value="(v: string) => update(index, { color: v })"
          />
        </div>

        <div class="ops">
          <a-tooltip title="上移">
            <a-button type="text" size="small" :disabled="index === 0" @click="move(index, -1)">
              <template #icon><UpOutlined /></template>
            </a-button>
          </a-tooltip>
          <a-tooltip title="下移">
            <a-button
              type="text"
              size="small"
              :disabled="index === items.length - 1"
              @click="move(index, 1)"
            >
              <template #icon><DownOutlined /></template>
            </a-button>
          </a-tooltip>
          <a-popconfirm
            :title="`删掉「${item.label || '这一项'}」？`"
            ok-text="删掉"
            cancel-text="算了"
            @confirm="remove(index)"
          >
            <a-button type="text" size="small" danger>
              <template #icon><DeleteOutlined /></template>
            </a-button>
          </a-popconfirm>
        </div>
      </div>

      <a-button type="dashed" block class="add" @click="add">
        <template #icon><PlusOutlined /></template>
        加一项
      </a-button>
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

.head-file {
  color: #bfbfbf;
}

.spacer {
  flex: 1;
}

.card {
  margin-bottom: 16px;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

.card-title {
  margin-bottom: 12px;
  font-weight: 600;
}

.preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 12px;
  background: #fafafa;
  border-radius: 8px;
}

.preview-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 999px;
  font-size: 13px;
}

.preview-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.preview-icon {
  color: #bfbfbf;
  font-size: 12px;
}

.row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
}

.index {
  padding-top: 8px;
  width: 18px;
  color: #bfbfbf;
  text-align: right;
}

.fields {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 8px;
}

.label-input {
  flex: 1;
  min-width: 0;
}

.to-field {
  flex: 1.4;
  min-width: 0;
}

.to-field :deep(.ant-select) {
  width: 100%;
}

.icon-select {
  flex: none;
  width: 140px;
}

.color-input {
  flex: none;
  width: 52px;
  padding: 2px 4px;
}

.ops {
  flex: none;
  display: flex;
  align-items: center;
  padding-top: 2px;
}

.add {
  margin-top: 12px;
}

.card-hint {
  margin: 12px 0 0;
  color: #8c8c8c;
  font-size: 12px;
  line-height: 1.7;
}

.field-error {
  margin-top: 4px;
  color: #cf1322;
  font-size: 12px;
}

.field-warn {
  margin-top: 4px;
  color: #d46b08;
  font-size: 12px;
}

.mono-input {
  font-family: var(--mono);
}

.muted {
  color: #bfbfbf;
  font-size: 13px;
}
</style>
