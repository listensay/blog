<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import UiButton from './UiButton.vue'
const props = withDefaults(defineProps<{ title: string; busy?: boolean; wide?: boolean }>(), {
  wide: false,
})
const open = defineModel<boolean>('open', { required: true })
const dialog = ref<HTMLDialogElement>()
const titleId = useId()
watch(
  open,
  async (value) => {
    await nextTick()
    if (value && !dialog.value?.open) dialog.value?.showModal()
    else if (!value && dialog.value?.open) dialog.value?.close()
  },
  { immediate: true },
)
onBeforeUnmount(() => dialog.value?.close())
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && !event.defaultPrevented) {
    event.preventDefault()
    if (!props.busy) open.value = false
  }
}
function clickOutside(event: MouseEvent) {
  if (props.busy || event.target !== dialog.value || !dialog.value) return
  const rect = dialog.value.getBoundingClientRect()
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  )
    open.value = false
}
</script>
<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      :aria-labelledby="titleId"
      class="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-auto rounded-sm border border-panel-line bg-panel p-0 text-panel-text shadow-xl backdrop:bg-panel-text/45"
      :class="wide ? 'max-w-3xl' : 'max-w-md'"
      @cancel.prevent="!busy && (open = false)"
      @close="open = false"
      @click="clickOutside"
      @keydown="keydown"
    >
      <header class="flex items-center justify-between gap-4 border-b border-panel-line px-5 py-3">
        <h2 :id="titleId" class="text-lg font-semibold">{{ title }}</h2>
        <UiButton
          variant="ghost"
          icon="close"
          aria-label="关闭弹窗"
          title="关闭"
          :disabled="busy"
          @click="open = false"
        />
      </header>
      <div class="p-5"><slot v-if="open" /></div>
    </dialog>
  </Teleport>
</template>
