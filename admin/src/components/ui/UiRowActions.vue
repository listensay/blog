<script setup lang="ts">
import { confirmAction } from '@/composables/useFeedback'
import UiButton from './UiButton.vue'
const props = defineProps<{ first: boolean; last: boolean; label: string }>()
const emit = defineEmits<{ move: [delta: number]; remove: [] }>()
async function remove() {
  if (
    await confirmAction({
      title: `删除「${props.label || '当前项'}」？`,
      confirmText: '删除',
      danger: true,
    })
  )
    emit('remove')
}
</script>
<template>
  <div class="flex shrink-0 items-center gap-1">
    <UiButton
      variant="ghost"
      icon="up"
      title="上移"
      aria-label="上移"
      :disabled="first"
      @click="emit('move', -1)"
    />
    <UiButton
      variant="ghost"
      icon="down"
      title="下移"
      aria-label="下移"
      :disabled="last"
      @click="emit('move', 1)"
    />
    <UiButton variant="danger" icon="trash" title="删除" aria-label="删除" @click="remove" />
  </div>
</template>
