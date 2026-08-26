<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  DeleteOutlined,
  DownOutlined,
  PictureOutlined,
  PlusOutlined,
  UpOutlined,
} from '@ant-design/icons-vue'

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
  <div class="friends">
    <div v-for="(item, index) in friends" :key="index" class="row">
      <div class="avatar">
        <img v-if="previewOf(item.avatar)" :src="previewOf(item.avatar)" :alt="item.name" />
        <span v-else class="avatar-fallback">{{ initial(item.name) }}</span>
      </div>

      <div class="fields">
        <div class="line">
          <a-input
            :value="item.name"
            placeholder="站点名称"
            @update:value="(v: string) => update(index, { name: v })"
          />
          <a-input
            :value="item.url"
            class="mono-input"
            placeholder="https://example.com 或 /about"
            @update:value="(v: string) => update(index, { url: v })"
          />
        </div>

        <div class="line">
          <a-input
            :value="item.description"
            placeholder="描述（可选）"
            @update:value="(v: string) => update(index, { description: v })"
          />
          <a-space-compact class="avatar-field">
            <a-input
              :value="item.avatar ?? ''"
              class="mono-input"
              placeholder="头像地址（可选）"
              @update:value="(v: string) => update(index, { avatar: v })"
            />
            <a-tooltip title="从图片库选一张">
              <a-button @click="pickingFor = index">
                <template #icon><PictureOutlined /></template>
              </a-button>
            </a-tooltip>
          </a-space-compact>
        </div>
      </div>

      <div class="ops">
        <a-tooltip title="上移">
          <a-button type="text" size="small" :disabled="index === 0" @click="move(index, -1)">
            <template #icon><UpOutlined /></template>
          </a-button>
        </a-tooltip>
        <a-tooltip title="下移">
          <a-button
            type="text"
            size="small"
            :disabled="index === friends.length - 1"
            @click="move(index, 1)"
          >
            <template #icon><DownOutlined /></template>
          </a-button>
        </a-tooltip>
        <a-popconfirm
          :title="`删除「${item.name || '当前项'}」？`"
          ok-text="删除"
          cancel-text="取消"
          @confirm="remove(index)"
        >
          <a-button type="text" size="small" danger>
            <template #icon><DeleteOutlined /></template>
          </a-button>
        </a-popconfirm>
      </div>
    </div>

    <p v-if="!friends.length" class="empty">还没有友链。</p>

    <a-button type="dashed" block @click="add">
      <template #icon><PlusOutlined /></template>
      加一条友链
    </a-button>

    <ImagePickerModal v-model:open="pickerOpen" @select="pickAvatar($event.name)" />
  </div>
</template>

<style scoped>
.friends {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
}

.avatar {
  flex: none;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  background: #e6f4ff;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  color: #1677ff;
  font-size: 18px;
  font-weight: 600;
}

.fields {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.line {
  display: flex;
  gap: 8px;
}

.line > * {
  flex: 1;
  min-width: 0;
}

.avatar-field {
  display: flex;
}

.ops {
  flex: none;
  display: flex;
  align-items: center;
}

.mono-input {
  font-family: var(--mono);
}

.empty {
  margin: 0;
  color: #bfbfbf;
  font-size: 13px;
}

.hint {
  margin: 0;
  color: #8c8c8c;
  font-size: 12px;
  line-height: 1.7;
}
</style>
