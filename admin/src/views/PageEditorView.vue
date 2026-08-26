<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, useTemplateRef } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import { ArrowLeftOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons-vue'

import { api } from '@/api'
import RichTextEditor from '@/components/RichTextEditor.vue'
import type { FriendLink, NavItem, PageDetail, PageInput } from '@/types'
import {
  detectRichTextRisks,
  htmlToMd,
  mdToHtml,
  pageContentDir,
  retargetImagePaths,
} from '@/utils/markdown'

const LINKS_FILE = 'pages/links.md'

const route = useRoute()
const router = useRouter()

const isNew = computed(() => route.name === 'page-new')
const file = computed(() => (typeof route.query.file === 'string' ? route.query.file : ''))

const loading = ref(true)
const saving = ref(false)
const loadError = ref('')

const form = reactive({
  title: '',
  description: '',
  name: '',
})

const preservedFriends = ref<FriendLink[]>([])

const raw = ref<Record<string, unknown>>({})

const original = reactive({ body: '', name: '', file: '', path: '' })

const bodyMarkdown = ref('')
const bodyHtml = ref('')
const bodyDirty = ref(false)
const activeTab = ref<'rich' | 'source'>('rich')

const reserved = ref<string[]>([])
const navItems = ref<NavItem[]>([])

const editorRef = useTemplateRef<InstanceType<typeof RichTextEditor>>('editor')

function formSnapshot(): string {
  const text = (value: string | null | undefined) => value ?? ''
  return JSON.stringify([text(form.title), text(form.description), text(form.name)])
}

const baseline = ref(formSnapshot())
const metaDirty = computed(() => formSnapshot() !== baseline.value)
const dirty = computed(() => bodyDirty.value || metaDirty.value)

const bodyDir = computed(() => pageContentDir(original.name))
const saveDir = computed(() => pageContentDir(form.name))

const path = computed(() => (form.name ? `/${form.name}` : ''))

const nameError = computed(() => {
  if (!form.name) return '必填项'
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(form.name)) {
    return '只能用小写字母、数字和连字符'
  }
  return ''
})

const reservedClash = computed(() => {
  const first = form.name.split('/')[0] ?? ''
  return first && reserved.value.includes(first) ? first : ''
})

const renaming = computed(() => !isNew.value && !!original.name && form.name !== original.name)

const navPointingToPage = computed(() => navItems.value.filter((item) => item.to === original.path))

const navPointingHere = computed(() => (renaming.value ? navPointingToPage.value : []))

const navNames = (items: NavItem[]) => items.map((item) => `「${item.label}」`).join('、')

const removeHint = computed(() => {
  const nav = navPointingToPage.value.length
    ? `顶部菜单中 ${navNames(navPointingToPage.value)} 指向该页面。`
    : ''
  return `将这个页面移到回收站？${original.path} 将返回 404。${nav}`
})

const risks = computed(() => detectRichTextRisks(bodyMarkdown.value))

const stats = computed(() => {
  const text = bodyMarkdown.value
  return {
    chars: text.length,
    images: (text.match(/!\[[^\]]*\]\([^)]+\)/g) ?? []).length,
  }
})

onMounted(async () => {
  if (!isNew.value && file.value === LINKS_FILE) {
    await router.replace({ name: 'links' })
    return
  }

  window.addEventListener('keydown', onKeydown)
  window.addEventListener('beforeunload', onBeforeUnload)

  api
    .getNav()
    .then((nav) => {
      navItems.value = nav.items
    })
    .catch(() => {
      navItems.value = []
    })

  try {
    reserved.value = (await api.listPages()).reserved

    if (isNew.value) {
      setBody('')
    } else {
      fill(await api.getPage(file.value))
    }
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
    baseline.value = formSnapshot()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('beforeunload', onBeforeUnload)
})

function fill(detail: PageDetail) {
  form.title = detail.title
  form.description = detail.description
  form.name = detail.name
  preservedFriends.value = detail.friends.map((item) => ({ ...item }))

  raw.value = detail.raw
  original.body = detail.body
  original.name = detail.name
  original.file = detail.file
  original.path = detail.path

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
  let body: string

  if (!bodyDirty.value) {
    body = original.body
  } else if (activeTab.value === 'rich') {
    body = htmlToMd(editorRef.value?.getHtml() ?? '', bodyDir.value)
  } else {
    body = bodyMarkdown.value
  }

  if (bodyDir.value !== saveDir.value) {
    body = retargetImagePaths(body, bodyDir.value, saveDir.value)
  }

  return body
}

async function save() {
  if (saving.value || loading.value) return

  if (!form.title.trim()) {
    message.warning('标题不能为空')
    return
  }
  if (nameError.value) {
    message.warning(`文件名${nameError.value}`)
    return
  }

  if (renaming.value && !(await confirmRename())) return

  const input: PageInput = {
    title: form.title,
    description: form.description,
    name: form.name,
    friends: preservedFriends.value,
    body: currentBody(),
    raw: raw.value,
  }

  saving.value = true
  try {
    const previousFile = original.file

    const saved = isNew.value
      ? await api.createPage(input)
      : await api.updatePage(previousFile, input)

    message.success(`已保存到 content/${saved.file}`)
    fill(saved)

    if (saved.file !== previousFile) {
      await router.replace({ name: 'page-edit', query: { file: saved.file } })
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  } finally {
    saving.value = false
  }
}

function confirmRename(): Promise<boolean> {
  const navNote = navPointingHere.value.length
    ? `顶部菜单中 ${navNames(navPointingHere.value)} 指向 ${original.path}，改名后需在「菜单」中更新。`
    : ''

  return new Promise((resolve) => {
    Modal.confirm({
      title: '页面网址将改变',
      content: `${original.path} → ${path.value}。原网址将返回 404。${navNote}`,
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
}

async function remove() {
  try {
    await api.deletePage(original.file)
    message.success('已移到回收站')
    baseline.value = formSnapshot()
    bodyDirty.value = false
    await router.push({ name: 'pages' })
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
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
      <a-button type="text" @click="router.push({ name: 'pages' })">
        <template #icon><ArrowLeftOutlined /></template>
        页面列表
      </a-button>

      <span class="head-title">{{ isNew ? '新页面' : form.title || '未命名' }}</span>
      <a-tag v-if="dirty" color="orange">未保存</a-tag>

      <span class="spacer" />

      <a-popconfirm
        v-if="!isNew"
        :title="removeHint"
        ok-text="移到回收站"
        cancel-text="取消"
        @confirm="remove"
      >
        <a-button danger>
          <template #icon><DeleteOutlined /></template>
          删除
        </a-button>
      </a-popconfirm>

      <a-button type="primary" :loading="saving" @click="save">
        <template #icon><SaveOutlined /></template>
        保存 ⌘S
      </a-button>
    </div>

    <div class="grid">
      <div class="main">
        <a-input
          v-model:value="form.title"
          class="title-input"
          placeholder="页面标题"
          size="large"
        />

        <a-alert v-if="risks.length" type="warning" show-icon class="risk">
          <template #message> 存在富文本编辑器不支持的语法，请在「Markdown 源码」中编辑 </template>
          <template #description>
            <div v-for="risk in risks" :key="risk.label" class="risk-item">
              {{ risk.label }} —— <code>{{ risk.sample }}</code>
            </div>
            富文本模式会丢失这些结构。
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
              :auto-size="{ minRows: 20 }"
              spellcheck="false"
              @input="bodyDirty = true"
            />
          </a-tab-pane>
        </a-tabs>

        <div class="stats">{{ stats.chars }} 字 · {{ stats.images }} 张图</div>
      </div>

      <aside class="side">
        <a-form layout="vertical" :colon="false">
          <a-form-item
            label="文件名"
            :validate-status="nameError ? 'error' : ''"
            :help="nameError || undefined"
          >
            <a-input
              v-model:value="form.name"
              class="mono-input"
              addon-after=".md"
              placeholder="about"
            />
            <div class="field-hint mono">content/pages/{{ form.name || '…' }}.md</div>
          </a-form-item>

          <a-form-item label="页面网址">
            <div class="url-preview mono">{{ path || '未设置' }}</div>

            <a-alert
              v-if="reservedClash"
              type="error"
              show-icon
              class="url-warn"
              :message="`/${reservedClash} 是站点自己的页面`"
              :description="`站点已内置该路径，这个文件不会生效，请更换文件名。`"
            />

            <a-alert
              v-else-if="renaming"
              type="warning"
              show-icon
              class="url-warn"
              :message="`网址将从 ${original.path} 改为 ${path}`"
            >
              <template #description>
                原网址将返回 404。
                <template v-if="navPointingHere.length">
                  顶部菜单中
                  <b>{{ navPointingHere.map((item) => item.label).join('、') }}</b>
                  指向原网址，请在「菜单」中更新。
                </template>
              </template>
            </a-alert>
          </a-form-item>

          <a-form-item label="描述">
            <a-textarea
              v-model:value="form.description"
              :auto-size="{ minRows: 2, maxRows: 4 }"
              placeholder="SEO描述"
            />
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

.title-input {
  margin-bottom: 12px;
  font-size: 18px;
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

.field-hint {
  margin: 6px 0 0;
  color: #8c8c8c;
  font-size: 12px;
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

.url-warn {
  margin-top: 8px;
}

.mono-input {
  font-family: var(--mono);
}

:deep(.ant-tabs-content-holder) {
  min-width: 0;
}
</style>
