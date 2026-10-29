<script setup lang="ts">
import { computed, ref } from 'vue'

import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiTags from '@/components/ui/UiTags.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import ImagePickerModal from '@/components/ImagePickerModal.vue'
import SettingsShell from '@/components/SettingsShell.vue'
import { useSettings } from '@/composables/useSettings'
import type { ImageItem } from '@/types'

const {
  loading,
  saving,
  loadError,
  fileError,
  fileMissing,
  settings,
  categories,
  dirty,
  saved,
  saveError,
  refreshError,
  retry,
} = useSettings()

const site = computed(() => settings.value.site)

const pickerOpen = ref(false)

function onPickOgImage(image: ImageItem) {
  settings.value.site.ogImage = `/images/${image.name}`
}

const ogPreview = computed(() => {
  const src = site.value.ogImage.trim()
  if (!src) return ''
  return src.startsWith('/') ? `/blog-public${src}` : src
})

const categoryOptions = computed(() =>
  categories.value.map((item) => ({
    value: item.value,
    label: item.name,
  })),
)

const urlWarning = computed(() => {
  const url = site.value.url.trim()
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) return '需以 http:// 或 https:// 开头'
  return ''
})
</script>

<template>
  <SettingsShell
    title="系统设置"
    :loading="loading"
    :saving="saving"
    :dirty="dirty"
    :saved="saved"
    :save-error="saveError"
    :refresh-error="refreshError"
    :blocked="!!fileError"
    :load-error="loadError"
    :file-error="fileError"
    :file-missing="fileMissing"
    @retry="retry"
  >
    <section class="rounded-sm border border-panel-line bg-panel p-5">
      <h2 class="mb-5 text-lg font-semibold">站点信息</h2>
      <div class="max-w-2xl space-y-5">
        <label class="flex flex-col gap-2 text-sm text-panel-muted"
          >网站标题<UiInput
            v-model="settings.site.title"
            placeholder="Immki Blog"
            :maxlength="60"
            required
        /></label>
        <label class="flex flex-col gap-2 text-sm text-panel-muted"
          >网站描述<UiTextarea v-model="settings.site.description" :rows="3" :maxlength="300"
        /></label>
        <label class="flex flex-col gap-2 text-sm text-panel-muted"
          >站点地址<UiInput
            v-model="settings.site.url"
            class="font-mono"
            placeholder="https://blog.example.com"
            :aria-invalid="!!urlWarning || undefined"
            required
          /><span v-if="urlWarning" class="text-xs text-danger">{{ urlWarning }}</span></label
        >
        <label class="flex flex-col gap-2 text-sm text-panel-muted"
          >文章时区（UTC 偏移）<UiInput
            v-model="settings.site.utcOffset"
            class="max-w-40 font-mono"
            placeholder="+08:00"
        /></label>
      </div>
    </section>
    <section class="rounded-sm border border-panel-line bg-panel p-5">
      <h2 class="mb-5 text-lg font-semibold">默认分享图</h2>
      <div class="flex flex-col gap-4 sm:flex-row">
        <button
          type="button"
          aria-label="选择默认分享图"
          class="grid h-28 w-52 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-sm border border-dashed border-panel-muted/40 bg-panel-raised text-sm text-panel-muted hover:border-interactive"
          @click="pickerOpen = true"
        >
          <img
            v-if="ogPreview"
            :src="ogPreview"
            alt="分享图预览"
            class="size-full object-contain"
          /><span v-else>未设置</span>
        </button>
        <div class="w-full max-w-lg space-y-3">
          <label class="flex flex-col gap-2 text-sm text-panel-muted"
            >图片地址<UiInput
              v-model="settings.site.ogImage"
              class="font-mono"
              placeholder="/images/avatar.jpg" /></label
          ><UiButton icon="image" @click="pickerOpen = true">从图库选择</UiButton>
        </div>
      </div>
    </section>
    <section class="rounded-sm border border-panel-line bg-panel p-5">
      <h2 class="mb-5 text-lg font-semibold">首页</h2>
      <div class="max-w-2xl space-y-5">
        <label class="flex flex-col gap-2 text-sm text-panel-muted"
          >文章数量<input
            v-model.number="settings.site.home.postLimit"
            type="number"
            min="1"
            max="50"
            step="1"
            class="min-h-11 w-28 rounded-md border border-panel-line bg-panel-raised px-3 py-2 text-base tabular-nums text-panel-text focus:border-interactive focus-visible:-outline-offset-2"
        /></label>
        <div class="space-y-2">
          <span class="block text-sm text-panel-muted">首页隐藏分类</span
          ><UiTags
            v-model="settings.site.home.hiddenCategories"
            :options="categoryOptions"
            label="首页隐藏分类"
          />
        </div>
      </div>
    </section>
    <ImagePickerModal v-model:open="pickerOpen" @select="onPickOgImage" />
  </SettingsShell>
</template>
