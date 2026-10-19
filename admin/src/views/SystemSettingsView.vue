<script setup lang="ts">
import { computed, ref } from 'vue'

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
  canSave,
  load,
  save,
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
    :can-save="canSave"
    :load-error="loadError"
    :file-error="fileError"
    :file-missing="fileMissing"
    @reload="load"
    @save="save"
  >
    <div class="card">
      <div class="card-title">站点信息</div>

      <a-form layout="vertical" class="form">
        <a-form-item label="网站标题" required>
          <a-input
            v-model:value="settings.site.title"
            placeholder="Immki Blog"
            :maxlength="60"
            show-count
          />
        </a-form-item>

        <a-form-item label="网站描述">
          <a-textarea
            v-model:value="settings.site.description"
            :rows="2"
            :maxlength="300"
            show-count
          />
        </a-form-item>

        <a-form-item label="站点地址" required>
          <a-input
            v-model:value="settings.site.url"
            class="mono-input"
            placeholder="https://blog.example.com"
          />
          <div v-if="urlWarning" class="field-warn">{{ urlWarning }}</div>
        </a-form-item>

        <a-form-item label="文章时区（UTC 偏移）">
          <a-input
            v-model:value="settings.site.utcOffset"
            class="mono-input offset-input"
            placeholder="+08:00"
          />
        </a-form-item>
      </a-form>
    </div>

    <div class="card">
      <div class="card-title">默认分享图</div>

      <div class="og">
        <button class="og-btn" type="button" @click="pickerOpen = true">
          <img v-if="ogPreview" :src="ogPreview" alt="分享图预览" />
          <span v-else class="og-empty">未设置</span>
        </button>

        <div class="og-fields">
          <a-input
            v-model:value="settings.site.ogImage"
            class="mono-input"
            placeholder="/images/avatar.jpg"
          />
          <a-button size="small" @click="pickerOpen = true">从图库选择</a-button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">首页</div>

      <a-form layout="vertical" class="form">
        <a-form-item label="文章数量">
          <a-input-number
            v-model:value="settings.site.home.postLimit"
            :min="1"
            :max="50"
            :precision="0"
          />
        </a-form-item>

        <a-form-item label="首页隐藏分类">
          <a-select
            v-model:value="settings.site.home.hiddenCategories"
            mode="tags"
            class="tags-select"
            :options="categoryOptions"
          />
        </a-form-item>
      </a-form>
    </div>

    <ImagePickerModal v-model:open="pickerOpen" @select="onPickOgImage" />
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

.form {
  max-width: 640px;
}

.form :deep(.ant-form-item) {
  margin-bottom: 16px;
}

.offset-input {
  width: 140px;
}

.tags-select {
  width: 100%;
}

.field-warn {
  margin-top: 4px;
  color: #d46b08;
  font-size: 12px;
  line-height: 1.6;
}

.og {
  display: flex;
  gap: 16px;
}

.og-btn {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 200px;
  height: 105px;
  padding: 0;
  overflow: hidden;
  background: #fafafa;
  border: 1px dashed #d9d9d9;
  border-radius: 8px;
  cursor: pointer;
}

.og-btn:hover {
  border-color: #1677ff;
}

.og-btn img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.og-empty {
  color: #8c8c8c;
  font-size: 13px;
}

.og-fields {
  flex: 1;
  min-width: 0;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.og-fields :deep(.ant-input) {
  width: 100%;
}

.mono-input {
  font-family: var(--mono);
}
</style>
