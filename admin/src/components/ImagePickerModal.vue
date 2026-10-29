<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { api } from '@/api'
import { notify } from '@/composables/useFeedback'
import { useDataRefresh } from '@/composables/useDataRefresh'
import type { ImageItem } from '@/types'
import { sizeText } from '@/utils/bytes'
import UiAlert from './ui/UiAlert.vue'
import UiButton from './ui/UiButton.vue'
import UiInput from './ui/UiInput.vue'
import UiLoading from './ui/UiLoading.vue'
import UiModal from './ui/UiModal.vue'
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ select: [ImageItem] }>()
const loading = ref(false)
const uploading = ref(false)
const loadError = ref('')
const images = ref<ImageItem[]>([])
const keyword = ref('')
const fileInput = ref<HTMLInputElement>()
async function load() {
  loading.value = true
  loadError.value = ''
  try {
    images.value = (await api.listImages()).images
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}
watch(
  open,
  (isOpen) => {
    if (isOpen) void load()
  },
  { immediate: true },
)
useDataRefresh(load, () => open.value && !uploading.value)
const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return kw ? images.value.filter((image) => image.name.toLowerCase().includes(kw)) : images.value
})
function choose(item: ImageItem) {
  emit('select', item)
  open.value = false
}
async function upload(event: Event) {
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files ?? [])
  if (!files.length || uploading.value) return
  uploading.value = true
  try {
    for (const file of files) {
      try {
        const { reused } = await api.uploadImage(file.name, file)
        notify.success(reused ? '图片已存在' : '上传成功')
      } catch (err) {
        notify.error(err instanceof Error ? err.message : String(err))
      }
    }
    keyword.value = ''
    await load()
  } finally {
    uploading.value = false
    target.value = ''
  }
}
</script>
<template>
  <UiModal v-model:open="open" title="图片" wide :busy="uploading">
    <div class="mb-5 flex flex-wrap gap-2">
      <UiInput
        v-model="keyword"
        type="search"
        aria-label="搜索文件名"
        placeholder="搜索文件名"
        class="min-w-32 flex-1"
      />
      <UiButton
        variant="primary"
        icon="upload"
        :loading="uploading"
        :disabled="loading"
        @click="fileInput?.click()"
        >上传图片</UiButton
      >
      <input
        ref="fileInput"
        type="file"
        class="hidden"
        accept="image/*"
        multiple
        aria-label="上传图片"
        @change="upload"
      />
    </div>
    <UiLoading v-if="loading" />
    <div v-else-if="loadError" class="space-y-3">
      <UiAlert :message="loadError" /><UiButton icon="refresh" @click="load">重试</UiButton>
    </div>
    <p v-else-if="!filtered.length" class="py-12 text-center text-sm text-panel-muted">
      {{ images.length ? '无匹配图片' : '暂无图片' }}
    </p>
    <div
      v-else
      class="grid max-h-[55dvh] grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3 md:grid-cols-4"
    >
      <button
        v-for="item in filtered"
        :key="item.name"
        type="button"
        :disabled="uploading"
        class="flex min-w-0 cursor-pointer flex-col gap-2 rounded-sm border border-panel-line bg-panel-raised p-3 text-left hover:border-interactive disabled:opacity-50"
        @click="choose(item)"
      >
        <img
          :src="item.previewUrl"
          :alt="item.name"
          loading="lazy"
          class="h-24 w-full rounded-sm object-contain"
        />
        <span class="w-full truncate font-mono text-xs" :title="item.name">{{ item.name }}</span
        ><span class="text-xs tabular-nums text-panel-muted">{{ sizeText(item.bytes) }}</span>
      </button>
    </div>
  </UiModal>
</template>
