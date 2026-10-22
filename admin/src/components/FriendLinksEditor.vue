<script setup lang="ts">
import { computed, ref } from 'vue'

import UiButton from './ui/UiButton.vue'
import UiInput from './ui/UiInput.vue'
import UiRowActions from './ui/UiRowActions.vue'
import ImagePickerModal from './ImagePickerModal.vue'
import type { FriendLink } from '@/types'
import { toSitePreviewSrc } from '@/utils/markdown'

const friends = defineModel<FriendLink[]>({ required: true })

const pickingFor = ref<number | null>(null)

const pickerOpen = computed({
  get: () => pickingFor.value !== null,
  set: (open: boolean) => {
    if (!open) pickingFor.value = null
  },
})

function update(index: number, patch: Partial<FriendLink>) {
  friends.value = friends.value.map((item, i) => (i === index ? { ...item, ...patch } : item))
}

function add() {
  friends.value = [...friends.value, { name: '', url: '', description: '' }]
}

function remove(index: number) {
  friends.value = friends.value.filter((_, i) => i !== index)
}

function move(index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= friends.value.length) return
  const next = [...friends.value]
  const a = next[index]!
  const b = next[target]!
  next[index] = b
  next[target] = a
  friends.value = next
}

function pickAvatar(name: string) {
  const index = pickingFor.value
  if (index === null) return
  update(index, { avatar: `/images/${encodeURI(name)}` })
  pickingFor.value = null
}

const previewOf = (avatar: string | undefined) => toSitePreviewSrc(avatar ?? '')

const initial = (name: string) => [...(name || '?')][0] ?? '?'
</script>

<template>
  <div class="space-y-4">
    <div
      v-for="(item, index) in friends"
      :key="index"
      class="flex flex-wrap items-start gap-4 rounded-sm border border-panel-line bg-panel-raised/40 p-4"
    >
      <div
        class="mt-7 grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-poster text-lg font-semibold text-white"
      >
        <img
          v-if="previewOf(item.avatar)"
          :src="previewOf(item.avatar)"
          :alt="item.name"
          class="size-full object-cover"
        /><span v-else>{{ initial(item.name) }}</span>
      </div>
      <div class="grid min-w-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <label class="flex flex-col gap-2 text-sm text-panel-muted"
          >站点名称<UiInput
            :model-value="item.name"
            @update:model-value="update(index, { name: $event })"
        /></label>
        <label class="flex flex-col gap-2 text-sm text-panel-muted"
          >地址<UiInput
            :model-value="item.url"
            class="font-mono"
            placeholder="https://example.com"
            @update:model-value="update(index, { url: $event })"
        /></label>
        <label class="flex flex-col gap-2 text-sm text-panel-muted"
          >描述<UiInput
            :model-value="item.description"
            @update:model-value="update(index, { description: $event })"
        /></label>
        <div class="space-y-2">
          <label :for="`friend-avatar-${index}`" class="text-sm text-panel-muted">头像地址</label>
          <div class="flex gap-2">
            <UiInput
              :id="`friend-avatar-${index}`"
              :model-value="item.avatar ?? ''"
              class="font-mono"
              placeholder="/images/avatar.jpg"
              @update:model-value="update(index, { avatar: $event })"
            /><UiButton
              icon="image"
              title="选择图片"
              aria-label="选择头像图片"
              @click="pickingFor = index"
            />
          </div>
        </div>
      </div>
      <UiRowActions
        class="ml-auto lg:pt-7"
        :first="index === 0"
        :last="index === friends.length - 1"
        :label="item.name"
        @move="move(index, $event)"
        @remove="remove(index)"
      />
    </div>
    <p v-if="!friends.length" class="py-8 text-center text-sm text-panel-muted">暂无友情链接</p>
    <UiButton icon="plus" class="w-full" @click="add">添加链接</UiButton>
    <ImagePickerModal v-model:open="pickerOpen" @select="pickAvatar($event.name)" />
  </div>
</template>
