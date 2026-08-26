<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, useTemplateRef } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons-vue'

import { api } from '@/api'
import FriendLinksEditor from '@/components/FriendLinksEditor.vue'
import RichTextEditor from '@/components/RichTextEditor.vue'
import type { FriendLink, PageDetail, PageInput } from '@/types'
import { detectRichTextRisks, htmlToMd, mdToHtml, pageContentDir } from '@/utils/markdown'

const LINKS_NAME = 'links'
const LINKS_FILE = `pages/${LINKS_NAME}.md`

const loading = ref(true)
const saving = ref(false)
const loadError = ref('')
const missing = ref(false)

const form = reactive({
  title: '',
  description: '',
  friends: [] as FriendLink[],
})

const raw = ref<Record<string, unknown>>({})

const original = reactive({ body: '', file: LINKS_FILE })

const bodyMarkdown = ref('')
const bodyHtml = ref('')
const bodyDirty = ref(false)
const activeTab = ref<'rich' | 'source'>('rich')

const editorRef = useTemplateRef<InstanceType<typeof RichTextEditor>>('editor')

function formSnapshot(): string {
  const text = (value: string | null | undefined) => value ?? ''
  return JSON.stringify([
    text(form.title),
    text(form.description),
    form.friends.map((item) => [
      text(item.name),
      text(item.url),
      text(item.description),
      text(item.avatar),
    ]),
  ])
}

const baseline = ref(formSnapshot())
const metaDirty = computed(() => formSnapshot() !== baseline.value)
const dirty = computed(() => bodyDirty.value || metaDirty.value)

const bodyDir = computed(() => pageContentDir(LINKS_NAME))

const risks = computed(() => detectRichTextRisks(bodyMarkdown.value))

const titleError = computed(() => (form.title.trim() ? '' : '必填项'))

const stats = computed(() => {
  const text = bodyMarkdown.value
  return {
    chars: text.length,
    images: (text.match(/!\[[^\]]*\]\([^)]+\)/g) ?? []).length,
  }
})

async function load() {
  loading.value = true
  loadError.value = ''
  missing.value = false

  try {
    fill(await api.getPage(LINKS_FILE))
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err)
    if (text.includes('不存在')) {
      missing.value = true
      form.title = '友情链接'
      form.description = ''
      form.friends = []
      raw.value = {}
      original.body = ''
      setBody('')
      baseline.value = formSnapshot()
    } else {
      loadError.value = text
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('beforeunload', onBeforeUnload)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('beforeunload', onBeforeUnload)
})

function fill(detail: PageDetail) {
  form.title = detail.title
  form.description = detail.description
  form.friends = detail.friends.map((item) => ({ ...item }))

  raw.value = detail.raw
  original.body = detail.body
  original.file = detail.file

  setBody(detail.body)
  baseline.value = formSnapshot()

  if (detectRichTextRisks(detail.body).length) activeTab.value = 'source'
}

function setBody(markdown: string) {
  bodyMarkdown.value = markdown
  bodyHtml.value = mdToHtml(markdown, bodyDir.value)
  bodyDirty.value = false
}

function onTabChange(key: string | number) {
  if (key === 'source') {
    if (bodyDirty.value)
      bodyMarkdown.value = htmlToMd(editorRef.value?.getHtml() ?? '', bodyDir.value)
  } else {
    bodyHtml.value = mdToHtml(bodyMarkdown.value, bodyDir.value)
    editorRef.value?.setHtml(bodyHtml.value)
  }
}

function currentBody(): string {
  if (!bodyDirty.value) return original.body
  if (activeTab.value === 'rich') return htmlToMd(editorRef.value?.getHtml() ?? '', bodyDir.value)
  return bodyMarkdown.value
}

async function save() {
  if (saving.value || loading.value) return

  if (titleError.value) {
    message.warning('标题不能为空')
    return
  }

  const input: PageInput = {
    title: form.title,
    description: form.description,
    name: LINKS_NAME,
    friends: form.friends,
    body: currentBody(),
    raw: raw.value,
  }

  saving.value = true
  try {
    const saved = missing.value
      ? await api.createPage(input)
      : await api.updatePage(original.file, input)

    message.success(`已保存到 content/${saved.file}`)
    missing.value = false
    fill(saved)
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  } finally {
    saving.value = false
  }
}

function onKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    void save()
  }
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value) event.preventDefault()
}

onBeforeRouteLeave(async () => {
  if (!dirty.value) return true
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: '有未保存的修改',
      content: '离开后修改会丢失。',
      okText: '不保存并离开',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
})
</script>

<template>
  <a-spin :spinning="loading">
    <a-alert v-if="loadError" type="error" show-icon :message="loadError" class="load-error" />

    <div class="head">
      <span class="head-title">链接管理</span>
      <span class="mono head-file">content/{{ LINKS_FILE }}</span>
      <a-tag v-if="dirty" color="orange">未保存</a-tag>

      <span class="spacer" />

      <a-button :loading="loading" @click="load">
        <template #icon><ReloadOutlined /></template>
        刷新
      </a-button>

      <a-button type="primary" :loading="saving" @click="save">
        <template #icon><SaveOutlined /></template>
        保存 ⌘S
      </a-button>
    </div>

    <a-alert
      v-if="missing"
      type="warning"
      show-icon
      class="load-error"
      message="文件不存在"
      :description="`content/${LINKS_FILE} 还没有创建，保存后自动创建。`"
    />

    <div class="grid">
      <div class="main">
        <section class="card">
          <h3 class="card-title">友情链接</h3>
          <FriendLinksEditor v-model="form.friends" />
        </section>

        <section class="card">
          <h3 class="card-title">页面正文</h3>

          <a-alert v-if="risks.length" type="warning" show-icon class="risk">
            <template #message>存在富文本编辑器不支持的语法，请在「Markdown 源码」中编辑</template>
            <template #description>
              <div v-for="risk in risks" :key="risk.label" class="risk-item">
                {{ risk.label }} — <code>{{ risk.sample }}</code>
              </div>
            </template>
          </a-alert>

          <a-tabs v-model:activeKey="activeTab" @change="onTabChange">
            <a-tab-pane key="rich" tab="富文本">
              <RichTextEditor
                v-if="!loading"
                ref="editor"
                :html="bodyHtml"
                @dirty="bodyDirty = true"
              />
            </a-tab-pane>

            <a-tab-pane key="source" tab="Markdown 源码">
              <a-textarea
                v-model:value="bodyMarkdown"
                class="source-input mono"
                :auto-size="{ minRows: 16 }"
                spellcheck="false"
                @input="bodyDirty = true"
              />
            </a-tab-pane>
          </a-tabs>

          <div class="stats">{{ stats.chars }} 字 · {{ stats.images }} 张图</div>
        </section>
      </div>

      <aside class="side">
        <a-form layout="vertical" :colon="false">
          <a-form-item
            label="标题"
            :validate-status="titleError ? 'error' : ''"
            :help="titleError || undefined"
          >
            <a-input v-model:value="form.title" placeholder="友情链接" />
          </a-form-item>

          <a-form-item label="描述">
            <a-textarea
              v-model:value="form.description"
              :auto-size="{ minRows: 2, maxRows: 4 }"
              placeholder="SEO描述"
            />
          </a-form-item>

          <a-form-item label="页面网址">
            <div class="url-preview mono">/{{ LINKS_NAME }}</div>
          </a-form-item>
        </a-form>
      </aside>
    </div>
  </a-spin>
</template>

<style scoped>
.load-error {
  margin-bottom: 16px;
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.head-title {
  font-weight: 600;
}

.head-file {
  color: #bfbfbf;
}

.spacer {
  flex: 1;
}

.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
  align-items: start;
}

@media (max-width: 1100px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.main {
  min-width: 0;
}

.card {
  margin-bottom: 16px;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

.card-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
}

.risk {
  margin-bottom: 12px;
}

.risk-item {
  margin-bottom: 2px;
}

.source-input {
  font-size: 13px;
  line-height: 1.7;
}

.stats {
  margin-top: 8px;
  color: #bfbfbf;
  font-size: 12px;
}

.side {
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

.url-preview {
  padding: 4px 8px;
  background: #fafafa;
  border-radius: 4px;
  color: #595959;
  word-break: break-all;
}

:deep(.ant-tabs-content-holder) {
  min-width: 0;
}
</style>
