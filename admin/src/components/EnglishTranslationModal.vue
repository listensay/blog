<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { Modal, message } from 'ant-design-vue'
import { api } from '@/api'
import type { AiStatus, EnglishTranslation } from '@/types'
import { mdToHtml } from '@/utils/markdown'

const props = defineProps<{ open: boolean; sourceFile: string; aiStatus: AiStatus }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const state = ref<EnglishTranslation | null>(null)
const loading = ref(false)
const generating = ref(false)
const saving = ref(false)
const error = ref('')
const generatedBy = ref('')
const tab = ref('edit')
const form = reactive({ title: '', description: '', body: '', draft: true })
const baseline = ref('')
const snapshot = () => JSON.stringify(form)
const dirty = computed(() => !!state.value && snapshot() !== baseline.value)
const busy = computed(() => loading.value || generating.value || saving.value)
const canSave = computed(
  () =>
    !!state.value &&
    !!form.title.trim() &&
    !!form.description.trim() &&
    !!form.body.trim() &&
    !busy.value,
)
const preview = computed(() =>
  mdToHtml(form.body, state.value?.file.split('/').slice(0, -1).join('/') || 'en/blog'),
)
let requestId = 0

function fill(result: EnglishTranslation) {
  state.value = result
  Object.assign(form, result.content ?? { title: '', description: '', body: '', draft: true })
  baseline.value = snapshot()
}

watch(
  () => [props.open, props.sourceFile] as const,
  async ([open, file]) => {
    const id = ++requestId
    if (!open || !file) return
    state.value = null
    error.value = ''
    generatedBy.value = ''
    tab.value = 'edit'
    loading.value = true
    try {
      const result = await api.getEnglishTranslation(file)
      if (id === requestId) fill(result)
    } catch (err) {
      if (id === requestId) error.value = err instanceof Error ? err.message : String(err)
    } finally {
      if (id === requestId) loading.value = false
    }
  },
  { immediate: true },
)

async function generate() {
  if (!state.value || busy.value || !props.aiStatus.enabled) return
  generating.value = true
  error.value = ''
  const id = requestId
  try {
    const result = await api.translateEnglish(props.sourceFile, state.value.sourceRevision)
    if (id !== requestId) return
    form.title = result.title
    form.description = result.description
    form.body = result.body
    generatedBy.value = result.model
    tab.value = 'edit'
    message.success('英文译文已生成，请预览后保存')
  } catch (err) {
    if (id === requestId) error.value = err instanceof Error ? err.message : String(err)
  } finally {
    if (id === requestId) generating.value = false
  }
}

function requestGenerate() {
  if (!dirty.value) return void generate()
  Modal.confirm({
    title: '重新生成会替换尚未保存的英文编辑',
    content: '已保存的英文版会保留，直到你再次点击保存。',
    okText: '重新翻译',
    cancelText: '继续编辑',
    onOk: generate,
  })
}

async function save() {
  if (!state.value || !canSave.value) return
  saving.value = true
  error.value = ''
  try {
    fill(
      await api.saveEnglishTranslation(props.sourceFile, {
        ...form,
        sourceRevision: state.value.sourceRevision,
        revision: state.value.revision,
      }),
    )
    generatedBy.value = ''
    message.success(form.draft ? '英文草稿已保存' : '英文版已保存，下次站点部署后生效')
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    saving.value = false
  }
}

function close() {
  if (busy.value) return
  if (!dirty.value) return emit('update:open', false)
  Modal.confirm({
    title: '英文版有未保存的修改',
    content: '关闭后本次编辑会丢失。',
    okText: '放弃修改',
    cancelText: '继续编辑',
    onOk: () => emit('update:open', false),
  })
}

function beforeUnload(event: BeforeUnloadEvent) {
  if (props.open && (dirty.value || generating.value)) event.preventDefault()
}
watch(
  () => props.open,
  (open) => {
    if (open) window.addEventListener('beforeunload', beforeUnload)
    else window.removeEventListener('beforeunload', beforeUnload)
  },
)
onBeforeUnmount(() => {
  ++requestId
  window.removeEventListener('beforeunload', beforeUnload)
})
</script>

<template>
  <a-modal
    :open="open"
    title="文章英文版"
    :width="1080"
    :mask-closable="false"
    :closable="!busy"
    :keyboard="!busy"
    @cancel="close"
  >
    <a-spin :spinning="loading">
      <a-alert v-if="error" type="error" show-icon :message="error" class="translation-alert" />
      <template v-if="state">
        <div class="translation-toolbar">
          <a-tag :color="state.content ? (state.content.draft ? 'orange' : 'green') : 'default'">{{
            state.content ? (state.content.draft ? '英文草稿' : '已有英文版') : '尚无英文版'
          }}</a-tag>
          <span class="translation-path">{{ state.path }}</span>
          <a-tooltip :title="aiStatus.enabled ? '翻译已保存的中文标题、摘要和全文' : aiStatus.hint">
            <a-button
              :disabled="!aiStatus.enabled || loading || saving"
              :loading="generating"
              @click="requestGenerate"
              >{{ state.content || form.body ? 'AI 重新翻译' : 'AI 翻译英文版' }}</a-button
            >
          </a-tooltip>
        </div>
        <a-alert
          v-if="state.outdated"
          type="warning"
          show-icon
          message="原文有更新，或当前译文尚未记录对应的原文版本。请核对后保存。"
          class="translation-alert"
        />
        <a-alert
          v-if="generating"
          type="info"
          show-icon
          message="正在翻译全文，请稍候。完成后会显示可编辑的译文。"
          class="translation-alert"
        />
        <p class="translation-note">
          英文版与中文共用文章地址中的 slug、日期、分类、标签和封面。保存英文版不会改动中文正文。
        </p>
        <p v-if="generatedBy" class="translation-note">
          本次翻译模型：{{ generatedBy }} · 尚需保存
        </p>
        <a-form layout="vertical" :colon="false" :disabled="busy">
          <a-form-item label="英文标题"
            ><a-input v-model:value="form.title" :maxlength="200" placeholder="English title"
          /></a-form-item>
          <a-form-item label="英文摘要"
            ><a-textarea
              v-model:value="form.description"
              :auto-size="{ minRows: 2, maxRows: 4 }"
              :maxlength="1000"
              placeholder="English description"
          /></a-form-item>
          <a-tabs v-model:activeKey="tab">
            <a-tab-pane key="edit" tab="英文 Markdown"
              ><a-textarea
                v-model:value="form.body"
                :auto-size="{ minRows: 15, maxRows: 26 }"
                class="translation-source"
                placeholder="点击 AI 翻译，或在此填写英文正文"
            /></a-tab-pane>
            <a-tab-pane key="preview" tab="英文预览">
              <iframe
                class="translation-preview"
                title="英文文章预览"
                sandbox=""
                :srcdoc="`<!doctype html><html lang=&quot;en&quot;><head><meta charset=&quot;utf-8&quot;><style>body{font:16px/1.7 system-ui;padding:16px;color:#334155}img{max-width:100%}pre{overflow:auto;background:#f1f5f9;padding:12px}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}</style></head><body>${preview}</body></html>`"
              />
            </a-tab-pane>
            <a-tab-pane key="source" tab="中文原文">
              <pre class="translation-original">{{ state.source.body }}</pre>
            </a-tab-pane>
          </a-tabs>
          <div class="translation-publication">
            <a-switch
              :checked="!form.draft"
              :disabled="busy || state.source.draft"
              @change="(value) => (form.draft = !value)"
            />
            <span>{{ form.draft ? '保存为英文草稿' : '发布英文版（站点部署后生效）' }}</span>
            <span v-if="state.source.draft" class="translation-note">请先发布中文原文</span>
          </div>
        </a-form>
      </template>
    </a-spin>
    <template #footer>
      <a-button :disabled="busy" @click="close">关闭</a-button>
      <a-button type="primary" :disabled="!canSave" :loading="saving" @click="save">{{
        form.draft ? '保存英文草稿' : '保存英文版'
      }}</a-button>
    </template>
  </a-modal>
</template>

<style scoped>
.translation-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.translation-path {
  flex: 1;
  color: #64748b;
  overflow-wrap: anywhere;
}
.translation-alert {
  margin-bottom: 14px;
}
.translation-note {
  color: #64748b;
  font-size: 13px;
}
.translation-source {
  font-family: ui-monospace, monospace;
  font-size: 13px;
}
.translation-preview {
  width: 100%;
  height: 480px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}
.translation-original {
  max-height: 480px;
  overflow: auto;
  white-space: pre-wrap;
  font-size: 13px;
}
.translation-publication {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 0;
}
</style>
