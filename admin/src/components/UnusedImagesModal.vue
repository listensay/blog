<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { api } from '@/api'
import { useDataRefresh } from '@/composables/useDataRefresh'
import { confirmAction, notify } from '@/composables/useFeedback'
import type { ImageItem, UnusedImages } from '@/types'
import { sizeText } from '@/utils/bytes'
import UiAlert from './ui/UiAlert.vue'
import UiButton from './ui/UiButton.vue'
import UiLoading from './ui/UiLoading.vue'
import UiModal from './ui/UiModal.vue'
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ done: [] }>()
const loading = ref(false)
const removing = ref(false)
const loadError = ref('')
const data = ref<UnusedImages | null>(null)
const selected = ref<string[]>([])
function selectAll(images: ImageItem[]) {
  selected.value = images.map((item) => item.name)
}
async function load(preserveSelection = false) {
  loading.value = true
  loadError.value = ''
  if (!preserveSelection) selected.value = []
  try {
    data.value = await api.unusedImages()
    if (preserveSelection) {
      const names = new Set(data.value.images.map((item) => item.name))
      selected.value = selected.value.filter((name) => names.has(name))
    } else selectAll(data.value.images)
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
useDataRefresh(
  () => load(true),
  () => open.value && !removing.value,
)
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
async function remove() {
  if (removing.value || loading.value || loadError.value || !selected.value.length) return
  const names = [...selected.value]
  if (
    !(await confirmAction({
      title: `永久删除选中的 ${names.length} 张图片？`,
      content: '此操作无法撤销。',
      confirmText: '删除',
      danger: true,
    }))
  )
    return
  removing.value = true
  try {
    const result = await api.cleanupImages(names)
    notify.success(`已删除 ${result.deleted.length} 张图片，释放 ${sizeText(result.bytes)}`)
    data.value = result.remaining
    selectAll(result.remaining.images)
    emit('done')
  } catch (err) {
    notify.error(err instanceof Error ? err.message : String(err))
  } finally {
    removing.value = false
  }
}
</script>
<template>
  <UiModal v-model:open="open" title="清理未引用图片" wide :busy="removing">
    <UiLoading v-if="loading" />
    <div v-else-if="loadError" class="space-y-3">
      <UiAlert :message="loadError" /><UiButton icon="refresh" @click="load()">重试</UiButton>
    </div>
    <template v-else>
      <div v-if="images.length" class="mb-5 flex flex-wrap items-center gap-4 text-sm">
        <label class="inline-flex min-h-11 cursor-pointer items-center gap-2"
          ><input
            type="checkbox"
            :checked="allChecked"
            :indeterminate="someChecked"
            :disabled="removing"
            class="size-4 accent-interactive"
            @change="toggleAll(($event.target as HTMLInputElement).checked)"
          />全选</label
        >
        <span class="tabular-nums text-panel-muted"
          >{{ images.length }} 张 · {{ sizeText(data?.unusedBytes ?? 0) }}</span
        >
      </div>
      <p v-if="!images.length" class="py-12 text-center text-sm text-panel-muted">暂无未引用图片</p>
      <div
        v-else
        class="grid max-h-[55dvh] grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3 md:grid-cols-4"
      >
        <label
          v-for="item in images"
          :key="item.name"
          class="relative flex min-w-0 cursor-pointer flex-col gap-2 rounded-sm border bg-panel-raised p-3 hover:border-interactive"
          :class="
            selected.includes(item.name)
              ? 'border-interactive bg-interactive/10'
              : 'border-panel-line'
          "
        >
          <input
            v-model="selected"
            type="checkbox"
            :value="item.name"
            :aria-label="`选择 ${item.name}`"
            :disabled="removing"
            class="absolute top-3 left-3 size-5 accent-interactive"
          />
          <img
            :src="item.previewUrl"
            alt=""
            loading="lazy"
            class="h-24 w-full rounded-sm object-contain"
          /><span class="w-full truncate font-mono text-xs" :title="item.name">{{ item.name }}</span
          ><span class="text-xs tabular-nums text-panel-muted">{{ sizeText(item.bytes) }}</span>
        </label>
      </div>
    </template>
    <div class="mt-5 flex flex-wrap justify-end gap-2 border-t border-panel-line pt-5">
      <UiButton :disabled="removing" @click="open = false">关闭</UiButton>
      <UiButton
        variant="danger"
        icon="trash"
        :disabled="loading || !!loadError || !selected.length"
        :loading="removing"
        @click="remove"
        >删除选中{{
          selected.length ? ` ${selected.length} 张 · ${sizeText(selectedBytes)}` : ''
        }}</UiButton
      >
    </div>
  </UiModal>
</template>
