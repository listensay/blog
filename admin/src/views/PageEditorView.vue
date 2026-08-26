<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, useTemplateRef } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import { ArrowLeftOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons-vue'

import { api } from '@/api'
import FriendLinksEditor from '@/components/FriendLinksEditor.vue'
import RichTextEditor from '@/components/RichTextEditor.vue'
import type { FriendLink, NavItem, PageDetail, PageInput } from '@/types'
import {
  detectRichTextRisks,
  htmlToMd,
  imageMarkdownPath,
  mdToHtml,
  pageContentDir,
  retargetImagePaths,
} from '@/utils/markdown'

const FRIENDS_FILE = 'pages/links.md'

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
  friends: [] as FriendLink[],
})

const raw = ref<Record<string, unknown>>({})

const original = reactive({ body: '', name: '', file: '', path: '', customRoute: false })

const bodyMarkdown = ref('')
const bodyHtml = ref('')
const bodyDirty = ref(false)
const activeTab = ref<'rich' | 'source'>('rich')

const reserved = ref<string[]>([])
const navItems = ref<NavItem[]>([])

const editorRef = useTemplateRef<InstanceType<typeof RichTextEditor>>('editor')

function formSnapshot(): string {
  const text = (value: string | null | undefined) => value ?? ''
  return JSON.stringify([
    text(form.title),
    text(form.description),
    text(form.name),
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

const bodyDir = computed(() => pageContentDir(original.name))
const saveDir = computed(() => pageContentDir(form.name))

const path = computed(() => (form.name ? `/${form.name}` : ''))

const nameError = computed(() => {
  if (!form.name) return '必填：页面的网址就是它'
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(form.name)) {
    return '只能用小写字母、数字和连字符（它直接进网址）'
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
  const gone = original.customRoute
    ? `${original.path} 那个页面的排版是站点上手写的，删了不会 404，会变成一个空页面（不报错）`
    : `${original.path} 会 404`
  const nav = navPointingToPage.value.length
    ? `，顶部菜单里 ${navNames(navPointingToPage.value)} 正指着它`
    : ''
  return `把这个页面移到 admin/.trash/？${gone}${nav}`
})

const showFriends = computed(() => !isNew.value && original.file === FRIENDS_FILE)

const risks = computed(() => detectRichTextRisks(bodyMarkdown.value))

const stats = computed(() => {
  const text = bodyMarkdown.value
  return {
    chars: text.length,
    images: (text.match(/!\[[^\]]*\]\([^)]+\)/g) ?? []).length,
  }
})

onMounted(async () => {
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
  form.friends = detail.friends.map((item) => ({ ...item }))

  raw.value = detail.raw
  original.body = detail.body
  original.name = detail.name
  original.file = detail.file
  original.path = detail.path
  original.customRoute = detail.customRoute

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
    message.warning('先写个标题')
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
    friends: form.friends,
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
    ? `顶部菜单里有 ${navNames(navPointingHere.value)} 指着 ${original.path}，改完记得去「菜单」里改。`
    : ''

  const customNote = original.customRoute
    ? `注意：${original.path} 的排版是站点上单独写的一个页面，它写死了读 ${original.file}。改名之后那个页面会空掉，除非你也去改对应的 .vue。`
    : ''

  return new Promise((resolve) => {
    Modal.confirm({
      title: '这会换掉页面的网址',
      content: `${original.path} → ${path.value}。旧网址会 404，别处指过来的链接都会断。${navNote}${customNote}`,
      okText: '知道了，改',
      okType: 'danger',
      cancelText: '算了',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
}

async function remove() {
  try {
    const { trashed } = await api.deletePage(original.file)
    message.success(`已移到 admin/.trash/${trashed}`)
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
      title: '还没保存',
      content: '改动会丢掉，确定离开吗？',
      okText: '不保存，离开',
      okType: 'danger',
      cancelText: '留下继续改',
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

      <span class="head-title">{{ isNew ? '新页面' : form.title || '（没有标题）' }}</span>
      <a-tag v-if="dirty" color="orange">未保存</a-tag>

      <span class="spacer" />

      <a-popconfirm
        v-if="!isNew"
        :title="removeHint"
        ok-text="移到回收站"
        cancel-text="算了"
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
          <template #message>
            这个页面里有富文本编辑器撑不住的语法，建议在「Markdown 源码」里改
          </template>
          <template #description>
            <div v-for="risk in risks" :key="risk.label" class="risk-item">
              {{ risk.label }} —— <code>{{ risk.sample }}</code>
            </div>
            富文本标签会把这些结构拍平成纯文字（比如 <code>&lt;details&gt;</code> 折叠块会散掉）。
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
            <p class="source-hint">
              这里写的内容会原样存进文件。图片路径按仓库约定写相对路径，比如
              <code>{{ imageMarkdownPath(bodyDir, 'x.png') }}</code>
            </p>
          </a-tab-pane>
        </a-tabs>

        <div class="stats">{{ stats.chars }} 字 · {{ stats.images }} 张图</div>

        <section v-if="showFriends" class="friends-card">
          <h3 class="friends-title">友情链接</h3>
          <p class="friends-sub">
            这一栏只有这个页面有 —— 站点上只有 <span class="mono">/links</span> 会渲染它。
            上面的正文是页面开头那段说明文字，下面这些是链接卡片。
          </p>
          <FriendLinksEditor v-model="form.friends" />
        </section>
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
            <div class="url-preview mono">{{ path || '（先填文件名）' }}</div>

            <a-alert
              v-if="reservedClash"
              type="error"
              show-icon
              class="url-warn"
              :message="`/${reservedClash} 是站点自己的页面`"
              :description="`那边是手写的 .vue，路由优先级更高，所以这个 md 文件永远不会被访问到。换个名字。`"
            />

            <a-alert
              v-else-if="renaming"
              type="warning"
              show-icon
              class="url-warn"
              :message="`网址会从 ${original.path} 换成 ${path}`"
            >
              <template #description>
                旧网址会 404。
                <template v-if="navPointingHere.length">
                  顶部菜单里
                  <b>{{ navPointingHere.map((item) => item.label).join('、') }}</b>
                  正指着旧网址，改完去「菜单」里改一下。
                </template>
              </template>
            </a-alert>

            <div v-else class="field-hint">
              页面没有 slug 字段，网址就是文件名。改名等于换网址。
            </div>
          </a-form-item>

          <a-form-item label="描述">
            <a-textarea
              v-model:value="form.description"
              :auto-size="{ minRows: 2, maxRows: 4 }"
              placeholder="显示在标题下面，也进 SEO"
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

.source-hint,
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

.friends-card {
  margin-top: 16px;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

.friends-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.friends-sub {
  margin: 4px 0 12px;
  color: #8c8c8c;
  font-size: 12px;
  line-height: 1.7;
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
