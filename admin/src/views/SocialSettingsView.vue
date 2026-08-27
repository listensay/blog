<script setup lang="ts">
import { computed, ref } from 'vue'
import { DeleteOutlined, DownOutlined, PlusOutlined, UpOutlined } from '@ant-design/icons-vue'

import ImagePickerModal from '@/components/ImagePickerModal.vue'
import SettingsShell from '@/components/SettingsShell.vue'
import SocialIcon from '@/components/SocialIcon.vue'
import { useSettings } from '@/composables/useSettings'
import type { ImageItem, SocialLink } from '@/types'

const {
  loading,
  saving,
  loadError,
  fileError,
  fileMissing,
  settings,
  icons,
  dirty,
  canSave,
  load,
  save,
} = useSettings()

const profile = computed(() => settings.value.profile)

const pickerOpen = ref(false)

function onPickAvatar(image: ImageItem) {
  settings.value.profile.avatar = `/images/${image.name}`
}

const avatarPreview = computed(() => {
  const src = profile.value.avatar.trim()
  if (!src) return ''
  return src.startsWith('/') ? `/blog-public${src}` : src
})

const DEFAULT_COLOR = '#3b82f6'

function update(index: number, patch: Partial<SocialLink>) {
  settings.value.profile.socials = profile.value.socials.map((item, i) =>
    i === index ? { ...item, ...patch } : item,
  )
}

function add() {
  settings.value.profile.socials = [
    ...profile.value.socials,
    { icon: 'website', label: '', url: '', color: DEFAULT_COLOR },
  ]
}

function remove(index: number) {
  settings.value.profile.socials = profile.value.socials.filter((_, i) => i !== index)
}

function move(index: number, delta: number) {
  const target = index + delta
  const list = profile.value.socials
  if (target < 0 || target >= list.length) return
  const next = [...list]
  const a = next[index]!
  const b = next[target]!
  next[index] = b
  next[target] = a
  settings.value.profile.socials = next
}

const duplicated = computed(() => {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const item of profile.value.socials) {
    const url = item.url.trim()
    if (!url) continue
    if (seen.has(url)) dupes.add(url)
    seen.add(url)
  }
  return dupes
})

const URL_OK = /^(https?:\/\/|mailto:|tel:|\/)/i

function badUrl(url: string): boolean {
  const value = url.trim()
  return value.length > 0 && !URL_OK.test(value)
}
</script>

<template>
  <SettingsShell
    title="社交设置"
    :loading="loading"
    :saving="saving"
    :dirty="dirty"
    :can-save="canSave"
    :load-error="loadError"
    :file-error="fileError"
    :file-missing="fileMissing"
    @reload="load"
    @save="save"
  >
    <div class="card">
      <div class="card-title">个人资料</div>

      <div class="profile">
        <div class="avatar-col">
          <button class="avatar-btn" type="button" @click="pickerOpen = true">
            <img v-if="avatarPreview" :src="avatarPreview" alt="头像预览" />
            <span v-else class="avatar-empty">未设置</span>
          </button>
          <a-button size="small" block @click="pickerOpen = true">从图库选择</a-button>
        </div>

        <div class="fields-col">
          <a-form layout="vertical">
            <a-form-item label="名字" required>
              <a-input
                v-model:value="settings.profile.name"
                placeholder="Immki"
                :maxlength="40"
                show-count
              />
              <div class="hint">用于首页标题、页脚和文章作者。</div>
            </a-form-item>

            <a-form-item label="个人简介">
              <a-textarea
                v-model:value="settings.profile.bio"
                placeholder="了解真相才能获得真正的自由。"
                :rows="2"
                :maxlength="300"
                show-count
              />
              <div class="hint">留空时使用网站描述。</div>
            </a-form-item>

            <a-form-item label="头像地址">
              <a-input
                v-model:value="settings.profile.avatar"
                class="mono-input"
                placeholder="/images/avatar.jpg"
              />
              <div class="hint">站内路径或 http 链接。</div>
            </a-form-item>
          </a-form>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">预览</div>
      <div class="preview">
        <span
          v-for="(item, index) in profile.socials"
          :key="index"
          class="preview-item"
          :style="{ color: item.color }"
        >
          <SocialIcon :name="item.icon" :size="16" />
          <span class="preview-label">{{ item.label || '未命名' }}</span>
        </span>
        <span v-if="!profile.socials.length" class="muted">暂无社交链接</span>
      </div>
    </div>

    <div class="card">
      <div class="card-title">社交链接</div>

      <div v-for="(item, index) in profile.socials" :key="index" class="row">
        <span class="index mono">{{ index + 1 }}</span>

        <div class="fields">
          <a-select
            :value="item.icon"
            class="icon-select"
            show-search
            option-filter-prop="label"
            @update:value="(v: unknown) => update(index, { icon: String(v) })"
          >
            <a-select-option
              v-for="option in icons"
              :key="option.value"
              :value="option.value"
              :label="option.label"
            >
              <span class="icon-option">
                <SocialIcon :name="option.value" :size="16" />
                {{ option.label }}
              </span>
            </a-select-option>
          </a-select>

          <a-input
            :value="item.label"
            class="label-input"
            placeholder="GitHub"
            @update:value="(v: string) => update(index, { label: v })"
          />

          <div class="url-field">
            <a-input
              :value="item.url"
              class="mono-input"
              placeholder="https://github.com/you"
              @update:value="(v: string) => update(index, { url: v })"
            />
            <div v-if="duplicated.has(item.url.trim())" class="field-error">地址重复</div>
            <div v-else-if="badUrl(item.url)" class="field-error">
              需以 http(s):// 、mailto: 、tel: 或 / 开头
            </div>
          </div>

          <a-input
            :value="item.color"
            class="color-input mono-input"
            type="color"
            @update:value="(v: string) => update(index, { color: v })"
          />
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
              :disabled="index === profile.socials.length - 1"
              @click="move(index, 1)"
            >
              <template #icon><DownOutlined /></template>
            </a-button>
          </a-tooltip>
          <a-popconfirm
            :title="`删除「${item.label || '当前项'}」？`"
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

      <a-button type="dashed" block class="add" @click="add">
        <template #icon><PlusOutlined /></template>
        加一项
      </a-button>
    </div>

    <ImagePickerModal v-model:open="pickerOpen" @select="onPickAvatar" />
  </SettingsShell>
</template>

<style scoped>
.card {
  margin-bottom: 16px;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

.card-title {
  margin-bottom: 12px;
  font-weight: 600;
}

.profile {
  display: flex;
  gap: 24px;
}

.avatar-col {
  flex: none;
  width: 128px;
}

.avatar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 128px;
  height: 128px;
  margin-bottom: 8px;
  padding: 0;
  overflow: hidden;
  background: #fafafa;
  border: 1px dashed #d9d9d9;
  border-radius: 50%;
  cursor: pointer;
}

.avatar-btn:hover {
  border-color: #1677ff;
}

.avatar-btn img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-empty {
  color: #8c8c8c;
  font-size: 13px;
}

.fields-col {
  flex: 1;
  min-width: 0;
  max-width: 640px;
}

.fields-col :deep(.ant-form-item) {
  margin-bottom: 16px;
}

.hint {
  margin-top: 4px;
  color: #8c8c8c;
  font-size: 12px;
  line-height: 1.6;
}

.preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 12px;
  background: #fafafa;
  border-radius: 8px;
}

.preview-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 999px;
  font-size: 13px;
}

.preview-label {
  color: #1f1f1f;
}

.icon-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
}

.index {
  padding-top: 8px;
  width: 18px;
  color: #bfbfbf;
  text-align: right;
}

.fields {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 8px;
}

.icon-select {
  flex: none;
  width: 150px;
}

.label-input {
  flex: 1;
  min-width: 0;
}

.url-field {
  flex: 1.6;
  min-width: 0;
}

.color-input {
  flex: none;
  width: 52px;
  padding: 2px 4px;
}

.ops {
  flex: none;
  display: flex;
  align-items: center;
  padding-top: 2px;
}

.add {
  margin-top: 12px;
}

.field-error {
  margin-top: 4px;
  color: #cf1322;
  font-size: 12px;
}

.mono-input {
  font-family: var(--mono);
}

.muted {
  color: #bfbfbf;
  font-size: 13px;
}
</style>
