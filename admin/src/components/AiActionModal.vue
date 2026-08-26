<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Modal } from 'ant-design-vue'

import DiffView from '@/components/DiffView.vue'
import type { AiTextResult } from '@/types'
import { checkMarkdownIntegrity } from '@/utils/ai'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  actionLabel: string
  scopeLabel: string
  formatOnly?: boolean
  loading: boolean
  error: string
  before: string
  result: AiTextResult | null
}>()

const emit = defineEmits<{
  apply: [string]
  retry: []
}>()

const draft = ref('')
const tab = ref<'diff' | 'text'>('diff')

watch(
  () => props.result,
  (result) => {
    draft.value = result?.text ?? ''
    tab.value = 'diff'
  },
)

const issues = computed(() =>
  props.result
    ? checkMarkdownIntegrity(props.before, draft.value, {
        proseMustMatch: props.formatOnly,
        headingLevelsMayChange: props.formatOnly,
      })
    : [],
)
const blocking = computed(() => issues.value.filter((i) => i.level === 'error'))

const lengthDelta = computed(() => {
  const from = props.before.length
  const to = draft.value.length
  if (!from) return ''
  const percent = Math.round(((to - from) / from) * 100)
  const sign = percent > 0 ? '+' : ''
  return `${from} 字 → ${to} 字（${sign}${percent}%）`
})

const usageText = computed(() => {
  const usage = props.result?.usage
  return usage ? `${usage.prompt} + ${usage.completion} tokens` : ''
})

function apply() {
  const text = draft.value.trim()
  if (!text) return

  if (blocking.value.length) {
    Modal.confirm({
      title: '结果存在问题，确认使用？',
      content: `${blocking.value.map((i) => i.label).join('、')}。应用后请自行核对。`,
      okText: '仍然替换',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => emit('apply', text),
    })
    return
  }

  emit('apply', text)
}
</script>

<template>
  <a-modal
    v-model:open="open"
    :title="`${actionLabel} · ${scopeLabel}`"
    width="1000px"
    :mask-closable="false"
    :keyboard="false"
  >
    <a-spin
      :spinning="loading"
      tip="AI 正在处理。推理模型会先想一会儿再输出，长文章可能要两三分钟…"
    >
      <a-alert v-if="error" type="error" show-icon :message="error" />

      <div v-else-if="result" class="body">
        <a-alert
          v-if="result.truncated"
          type="error"
          show-icon
          class="notice"
          message="结果已截断"
          description="已达到输出长度上限，剩余内容未生成。可调大 ADMIN_AI_MAX_TOKENS，或分段处理。"
        />

        <a-alert
          v-for="issue in issues"
          :key="issue.label"
          class="notice"
          :type="issue.level === 'error' ? 'error' : 'warning'"
          show-icon
          :message="issue.label"
          :description="issue.detail"
        />

        <a-alert
          v-if="!issues.length && !result.truncated"
          type="success"
          show-icon
          class="notice"
          :message="
            formatOnly
              ? '文字未改动，图片地址、代码块和标题数量一致'
              : '图片地址、代码块和标题层级与原文一致'
          "
        />

        <div class="meta">
          <span>{{ lengthDelta }}</span>
          <template v-if="usageText">
            <a-divider type="vertical" />
            <span>{{ usageText }}</span>
          </template>
          <a-divider type="vertical" />
          <span class="mono">{{ result.model }}</span>
        </div>

        <a-tabs v-model:activeKey="tab" size="small">
          <a-tab-pane key="diff" tab="对比">
            <DiffView :before="before" :after="draft" />
          </a-tab-pane>

          <a-tab-pane key="text" tab="结果（可以直接改）">
            <a-textarea
              v-model:value="draft"
              class="draft mono"
              :auto-size="{ minRows: 16, maxRows: 26 }"
              spellcheck="false"
            />
          </a-tab-pane>
        </a-tabs>
      </div>
    </a-spin>

    <template #footer>
      <span v-if="result && !loading" class="footer-hint">替换之后仍然可以按 ⌘Z 撤销</span>
      <a-button @click="open = false">取消</a-button>
      <a-button :disabled="loading" @click="emit('retry')">重新生成</a-button>
      <a-button
        type="primary"
        :disabled="loading || !result || !draft.trim()"
        :danger="blocking.length > 0"
        @click="apply"
      >
        替换原文
      </a-button>
    </template>
  </a-modal>
</template>

<style scoped>
.body {
  max-height: 62vh;
  overflow-y: auto;
}

.notice {
  margin-bottom: 8px;
}

.meta {
  margin: 4px 0 0;
  color: #8c8c8c;
  font-size: 12px;
}

.draft {
  font-size: 13px;
  line-height: 1.7;
}

.footer-hint {
  float: left;
  color: #bfbfbf;
  font-size: 12px;
  line-height: 32px;
}
</style>
