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
    label: item.name === item.value ? item.value : `${item.value}（${item.name}）`,
  })),
)

const titlePreview = computed(() => {
  const title = site.value.title.trim() || '站点名'
  return `文章标题 - ${title}`
})

const urlWarning = computed(() => {
  const url = site.value.url.trim()
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) return '需以 http:// 或 https:// 开头'
  if (url.endsWith('/')) return '保存时将移除结尾的斜杠'
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
          <div class="hint">
            内页标题：<code>{{ titlePreview }}</code>
          </div>
        </a-form-item>

        <a-form-item label="网站描述">
          <a-textarea
            v-model:value="settings.site.description"
            placeholder="了解真相才能获得真正的自由。"
            :rows="2"
            :maxlength="300"
            show-count
          />
          <div class="hint">
            用于 <code>meta description</code>、<code>og:description</code> 和 RSS。
          </div>
        </a-form-item>

        <a-form-item label="站点地址" required>
          <a-input
            v-model:value="settings.site.url"
            class="mono-input"
            placeholder="https://blog.example.com"
          />
          <div :class="urlWarning ? 'field-warn' : 'hint'">
            {{ urlWarning || '用于 canonical、sitemap 和 RSS。' }}
          </div>
        </a-form-item>

        <a-form-item label="时区偏移">
          <a-input
            v-model:value="settings.site.utcOffset"
            class="mono-input offset-input"
            placeholder="+08:00"
          />
          <div class="hint">文章日期的时区。</div>
        </a-form-item>
      </a-form>
    </div>

    <div class="card">
      <div class="card-title">分享图</div>

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
          <div class="hint">默认 <code>og:image</code>，文章的 <code>cover</code> 优先。</div>
          <a-button size="small" @click="pickerOpen = true">从图库选择</a-button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">首页</div>

      <a-form layout="vertical" class="form">
        <a-form-item label="首页显示文章条数">
          <a-input-number
            v-model:value="settings.site.home.postLimit"
            :min="1"
            :max="50"
            :precision="0"
          />
          <div class="hint">范围 1–50。</div>
        </a-form-item>

        <a-form-item label="首页隐藏的分类">
          <a-select
            v-model:value="settings.site.home.hiddenCategories"
            mode="tags"
            class="tags-select"
            placeholder="留空则不隐藏"
            :options="categoryOptions"
          />
          <div class="hint">分类的英文 slug，仅影响首页。</div>
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

.hint {
  margin-top: 4px;
  color: #8c8c8c;
  font-size: 12px;
  line-height: 1.6;
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
