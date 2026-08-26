<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { InboxOutlined } from '@ant-design/icons-vue'

import { api } from '@/api'
import type { ImageItem } from '@/types'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ select: [ImageItem] }>()

const loading = ref(false)
const uploading = ref(false)
const images = ref<ImageItem[]>([])
const keyword = ref('')

async function load() {
  loading.value = true
  try {
    images.value = (await api.listImages()).images
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  } finally {
    loading.value = false
  }
}

watch(open, (isOpen) => {
  if (isOpen) void load()
})

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return kw ? images.value.filter((i) => i.name.toLowerCase().includes(kw)) : images.value
})

function choose(item: ImageItem) {
  emit('select', item)
  open.value = false
}

async function handleUpload(file: File): Promise<boolean> {
  uploading.value = true
  try {
    const { image, reused } = await api.uploadImage(file.name, file)
    message.success(reused ? `复用了已有的 ${image.name}` : `已存到 public/images/${image.name}`)
    await load()
    keyword.value = ''
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  } finally {
    uploading.value = false
  }
  return false
}

const sizeText = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
</script>

<template>
  <a-modal v-model:open="open" title="图片" width="760px" :footer="null">
    <div class="head">
      <a-input v-model:value="keyword" placeholder="按文件名搜" allow-clear style="width: 240px" />
      <a-upload :before-upload="handleUpload" :show-upload-list="false" accept="image/*" multiple>
        <a-button type="primary" :loading="uploading">
          <template #icon><InboxOutlined /></template>
          上传新图片
        </a-button>
      </a-upload>
      <span class="hint">图片会存到 blog/public/images/</span>
    </div>

    <a-spin :spinning="loading">
      <div v-if="!filtered.length" class="empty">
        {{ images.length ? '没有匹配的图片。' : 'public/images/ 里还没有图片，先上传一张。' }}
      </div>

      <div v-else class="grid">
        <button v-for="item in filtered" :key="item.name" class="card" @click="choose(item)">
          <img :src="item.previewUrl" :alt="item.name" loading="lazy" />
          <span class="name mono" :title="item.name">{{ item.name }}</span>
          <span class="size">{{ sizeText(item.bytes) }}</span>
        </button>
      </div>
    </a-spin>
  </a-modal>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.hint {
  color: #8c8c8c;
  font-size: 12px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  max-height: 460px;
  overflow-y: auto;
  padding: 2px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  text-align: left;
}

.card:hover {
  border-color: #1677ff;
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
</style>
