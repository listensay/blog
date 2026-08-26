<script setup lang="ts">
import { computed, ref } from 'vue'

import { type DiffRow, changedRowCount, collapseDiff, diffLines } from '@/utils/ai'

const props = defineProps<{
  before: string
  after: string
}>()

const compact = ref(true)

const rows = computed<DiffRow[] | null>(() => diffLines(props.before, props.after))
const changed = computed(() => (rows.value ? changedRowCount(rows.value) : 0))
const shown = computed<DiffRow[]>(() => {
  if (!rows.value) return []
  return compact.value ? collapseDiff(rows.value) : rows.value
})

defineExpose({ changed })
</script>

<template>
  <div>
    <div v-if="rows && changed" class="bar">
      <a-checkbox v-model:checked="compact"><span class="small">只看改动</span></a-checkbox>
      <span class="small muted">{{ changed }} 行有改动</span>
    </div>

    <div v-if="!rows" class="empty">内容过长，已跳过行级对比，请查看「结果」标签。</div>
    <div v-else-if="!changed" class="empty">与原文完全一致，没有改动。</div>

    <div v-else class="diff mono">
      <div v-for="(row, index) in shown" :key="index" :class="['row', row.kind]">
        <span class="sign">{{ row.kind === 'add' ? '+' : row.kind === 'del' ? '−' : ' ' }}</span>
        <span class="text">{{ row.text || ' ' }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.small {
  font-size: 12px;
}

.muted {
  color: #bfbfbf;
}

.diff {
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  overflow: hidden;
  line-height: 1.7;
}

.row {
  display: flex;
  gap: 8px;
  padding: 0 8px;
}

.sign {
  flex: none;
  width: 10px;
  color: #bfbfbf;
  user-select: none;
}

.text {
  min-width: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.row.del {
  background: #fff1f0;
}

.row.del .sign,
.row.del .text {
  color: #a8071a;
}

.row.add {
  background: #f6ffed;
}

.row.add .sign,
.row.add .text {
  color: #135200;
}

.row.skip {
  background: #fafafa;
  color: #bfbfbf;
  user-select: none;
}

.empty {
  padding: 32px 0;
  text-align: center;
  color: #8c8c8c;
}
</style>
