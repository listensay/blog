<script setup lang="ts">
// AI 结果的确认弹窗：完整性警告 → 行级差异 → 可编辑的结果，点「替换原文」才动正文
// 有 error 级问题时替换要多点一次确认，但刻意不禁用 —— 有时就是想拿它当草稿再手改
import { computed, ref, watch } from 'vue'
import { Modal } from 'ant-design-vue'

import DiffView from '@/components/DiffView.vue'
import type { AiTextResult } from '@/types'
import { checkMarkdownIntegrity } from '@/utils/ai'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** 「润色」「修复格式」这类，标题上显示 */
  actionLabel: string
  /** 「选中的 128 字」「全文」 */
  scopeLabel: string
  /** 是不是「只改格式」那类动作。为真时要求文字一字不差，但允许标题层级变 */
  formatOnly?: boolean
  /** 请求还在路上 */
  loading: boolean
  /** 接口报的错。有值时只显示这条，不显示对比 */
  error: string
  /** 改写前的原文 */
  before: string
  /** 模型给的结果 */
  result: AiTextResult | null
}>()

const emit = defineEmits<{
  /** 用户确认要用的最终文本（可能被手动改过） */
  apply: [string]
  retry: []
}>()

/** 结果可编辑，所以在组件里存一份草稿 */
const draft = ref('')
const tab = ref<'diff' | 'text'>('diff')

// 每次拿到新结果都重置草稿和视图状态
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
      title: '这个结果有问题，确定还要用？',
      content: `${blocking.value.map((i) => i.label).join('、')}。用了之后记得自己再核一遍。`,
      okText: '知道了，还是替换',
      okType: 'danger',
      cancelText: '算了，我再改改',
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
          message="结果被截断了"
          description="模型是因为输出长度上限停下来的，后面的内容没生成。把 ADMIN_AI_MAX_TOKENS 调大，或者分段来改。"
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
              ? '文字一个字都没变，图片地址、代码块、标题数量也都对得上'
              : '图片地址、代码块、标题层级都和原文一致'
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
            <!-- 差异按当前草稿算，手动改完能立刻看到效果 -->
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
  /* 弹窗内部滚，别把整个页面撑长 */
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
