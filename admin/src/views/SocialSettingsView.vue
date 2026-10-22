<script setup lang="ts">
import { computed, ref } from 'vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiRowActions from '@/components/ui/UiRowActions.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'

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

const DEFAULT_COLOR = '#f4d47b'

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
    <section class="rounded-sm border border-panel-line bg-panel p-5">
      <h2 class="mb-5 text-lg font-semibold">个人资料</h2>
      <div class="flex flex-col gap-6 sm:flex-row">
        <div class="w-32 shrink-0">
          <button
            type="button"
            aria-label="选择头像"
            class="mb-3 grid size-32 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-panel-muted/40 bg-panel-raised text-sm text-panel-muted hover:border-interactive"
            @click="pickerOpen = true"
          >
            <img
              v-if="avatarPreview"
              :src="avatarPreview"
              alt="头像预览"
              class="size-full object-cover"
            /><span v-else>未设置</span></button
          ><UiButton class="w-full" @click="pickerOpen = true">从图库选择</UiButton>
        </div>
        <div class="w-full max-w-2xl space-y-5">
          <label class="flex flex-col gap-2 text-sm text-panel-muted"
            >名称<UiInput
              v-model="settings.profile.name"
              placeholder="Immki"
              :maxlength="40"
              required /></label
          ><label class="flex flex-col gap-2 text-sm text-panel-muted"
            >个人简介<UiTextarea v-model="settings.profile.bio" :rows="3" :maxlength="300" /></label
          ><label class="flex flex-col gap-2 text-sm text-panel-muted"
            >头像地址<UiInput
              v-model="settings.profile.avatar"
              class="font-mono"
              placeholder="/images/avatar.jpg"
          /></label>
        </div>
      </div>
    </section>
    <section class="rounded-sm border border-panel-line bg-panel p-5">
      <h2 class="mb-4 text-lg font-semibold">预览</h2>
      <div class="flex flex-wrap gap-3 rounded-sm bg-panel-raised p-4">
        <span
          v-for="(item, index) in profile.socials"
          :key="index"
          class="inline-flex items-center gap-2 px-2 py-1 text-sm"
          ><SocialIcon :name="item.icon" :size="18" :style="{ color: item.color }" />{{
            item.label || '未命名'
          }}</span
        ><span v-if="!profile.socials.length" class="text-sm text-panel-muted">暂无社交链接</span>
      </div>
    </section>
    <section class="rounded-sm border border-panel-line bg-panel p-5">
      <h2 class="mb-4 text-lg font-semibold">社交链接</h2>
      <div
        v-for="(item, index) in profile.socials"
        :key="index"
        class="flex flex-wrap items-start gap-3 border-b border-panel-line py-5 first:pt-0"
      >
        <span class="w-5 shrink-0 pt-9 text-sm tabular-nums text-panel-muted">{{ index + 1 }}</span>
        <div
          class="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-[180px_1fr_1.6fr_60px]"
        >
          <div class="space-y-2">
            <span class="block text-sm text-panel-muted">图标</span
            ><UiSelect
              :model-value="item.icon"
              :options="icons"
              label="社交图标"
              @update:model-value="update(index, { icon: $event })"
              ><template #icon><SocialIcon :name="item.icon" /></template
              ><template #option="{ option }"
                ><SocialIcon :name="option.value" />{{ option.label }}</template
              ></UiSelect
            >
          </div>
          <label class="flex flex-col gap-2 text-sm text-panel-muted"
            >名称<UiInput
              :model-value="item.label"
              placeholder="GitHub"
              @update:model-value="update(index, { label: $event })"
          /></label>
          <label class="flex flex-col gap-2 text-sm text-panel-muted"
            >地址<UiInput
              :model-value="item.url"
              class="font-mono"
              placeholder="https://github.com/you"
              :aria-invalid="duplicated.has(item.url.trim()) || badUrl(item.url) || undefined"
              @update:model-value="update(index, { url: $event })"
            /><span v-if="duplicated.has(item.url.trim())" class="text-xs text-danger"
              >地址重复</span
            ><span v-else-if="badUrl(item.url)" class="text-xs text-danger"
              >需以 http(s)://、mailto:、tel: 或 / 开头</span
            ></label
          >
          <label class="flex flex-col gap-2 text-sm text-panel-muted"
            >颜色<UiInput
              type="color"
              :model-value="item.color"
              class="h-11 cursor-pointer px-1"
              @update:model-value="update(index, { color: $event })"
          /></label>
        </div>
        <UiRowActions
          class="ml-auto sm:pt-7"
          :first="index === 0"
          :last="index === profile.socials.length - 1"
          :label="item.label"
          @move="move(index, $event)"
          @remove="remove(index)"
        />
      </div>
      <UiButton icon="plus" class="mt-5 w-full" @click="add">添加链接</UiButton>
    </section>
    <ImagePickerModal v-model:open="pickerOpen" @select="onPickAvatar" />
  </SettingsShell>
</template>
