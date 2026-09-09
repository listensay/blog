<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'

import { api } from '@/api'
import type { ImageItem, UnusedImages } from '@/types'
import { sizeText } from '@/utils/bytes'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ done: [] }>()

const loading = ref(false)
const removing = ref(false)
const data = ref<UnusedImages | null>(null)
const selected = ref<string[]>([])

function selectAll(images: ImageItem[]) {
  selected.value = images.map((item) => item.name)
}

async function load() {
  loading.value = true
  try {
    const result = await api.unusedImages()
    data.value = result
    selectAll(result.images)
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  } finally {
    loading.value = false
  }
}

watch(open, (isOpen) => {
  if (isOpen) void load()
})

const images = computed(() => data.value?.images ?? [])

const selectedBytes = computed(() =>
  images.value
    .filter((item) => selected.value.includes(item.name))
    .reduce((sum, item) => sum + item.bytes, 0),
)

const allChecked = computed(
  () => images.value.length > 0 && selected.value.length === images.value.length,
)

const someChecked = computed(
  () => selected.value.length > 0 && selected.value.length < images.value.length,
)

function toggleAll(checked: boolean) {
  if (checked) selectAll(images.value)
  else selected.value = []
}

function toggle(name: string) {
  selected.value = selected.value.includes(name)
    ? selected.value.filter((item) => item !== name)
    : [...selected.value, name]
}

async function remove() {
  removing.value = true
  try {
    const result = await api.cleanupImages(selected.value)
    message.success(`已删除 ${result.deleted.length} 张图片，释放 ${sizeText(result.bytes)}`)
    data.value = result.remaining
    selectAll(result.remaining.images)
    emit('done')
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  } finally {
    removing.value = false
  }
}
</script>

<template>
  <a-modal v-model:open="open" title="清理垃圾图片" width="780px" :footer="null">
    <a-spin :spinning="loading">
      <div class="head">
        <a-checkbox
          :checked="allChecked"
          :indeterminate="someChecked"
          :disabled="!images.length"
          @change="toggleAll(($event.target as HTMLInputElement).checked)"
        >
          全选
        </a-checkbox>

        <span v-if="data" class="hint">
          {{ data.total }} 张图片中 {{ images.length }} 张未被引用，合计
          {{ sizeText(data.unusedBytes) }}
        </span>

        <span class="spacer" />

        <a-tooltip v-if="data" :title="`扫描范围：${data.roots.join('、')}`">
          <span class="hint">已扫描 {{ data.scanned }} 个文件</span>
        </a-tooltip>
      </div>

      <div v-if="!loading && !images.length" class="empty">
        public/images 里没有未被引用的图片。
      </div>

      <div v-else class="grid">
        <div
          v-for="item in images"
          :key="item.name"
          class="card"
          :class="{ 'card-on': selected.includes(item.name) }"
          role="checkbox"
          tabindex="0"
          :aria-checked="selected.includes(item.name)"
          @click="toggle(item.name)"
          @keydown.enter.prevent="toggle(item.name)"
          @keydown.space.prevent="toggle(item.name)"
        >
          <a-checkbox class="pick" :checked="selected.includes(item.name)" />
          <img :src="item.previewUrl" :alt="item.name" loading="lazy" />
          <span class="name mono" :title="item.name">{{ item.name }}</span>
          <span class="size">{{ sizeText(item.bytes) }}</span>
        </div>
      </div>
    </a-spin>

    <div class="foot">
      <a-button @click="open = false">关闭</a-button>

      <a-popconfirm
        :disabled="!selected.length"
        :title="`删除选中的 ${selected.length} 张图片？文件会直接从 public/images 移除，不进回收站。`"
        ok-text="删除"
        ok-type="danger"
        cancel-text="取消"
        @confirm="remove"
      >
        <a-button danger type="primary" :disabled="!selected.length" :loading="removing">
          删除选中{{ selected.length ? ` ${selected.length} 张 · ${sizeText(selectedBytes)}` : '' }}
        </a-button>
      </a-popconfirm>
    </div>
  </a-modal>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.spacer {
  flex: 1;
}

.hint {
  color: #8c8c8c;
  font-size: 12px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  max-height: 440px;
  overflow-y: auto;
  padding: 2px;
}

.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
}

.card-on {
  border-color: #1677ff;
  background: #f0f7ff;
}

.card:focus-visible {
  outline: 2px solid #1677ff;
  outline-offset: 1px;
}

.pick {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 2px;
  border-radius: 4px;
  background: rgb(255 255 255 / 88%);
  /* 整张卡片负责切换选中，勾选框只做显示。 */
  pointer-events: none;
}

.card img {
  width: 100%;
  height: 88px;
  object-fit: contain;
  background: #fafafa;
  border-radius: 4px;
}

.name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.size {
  color: #bfbfbf;
  font-size: 11px;
}

.empty {
  padding: 40px 0;
  text-align: center;
  color: #8c8c8c;
}

.foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
</style>
