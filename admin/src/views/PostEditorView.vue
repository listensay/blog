<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, useTemplateRef, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  DownOutlined,
  HighlightOutlined,
  MedicineBoxOutlined,
  PictureOutlined,
  SaveOutlined,
} from '@ant-design/icons-vue'

import { api } from '@/api'
import AiActionModal from '@/components/AiActionModal.vue'
import AiMetaModal from '@/components/AiMetaModal.vue'
import ImagePickerModal from '@/components/ImagePickerModal.vue'
import RichTextEditor from '@/components/RichTextEditor.vue'
import type { AiAction, AiMetaResult, AiScope, AiStatus, AiTextResult, PostDetail, PostInput } from '@/types'
import { AI_ACTIONS, actionLabel, replaceBodyKeepEdges, unwrapSingleParagraph } from '@/utils/ai'
import {
  detectRichTextRisks,
  htmlToMd,
  imageMarkdownPath,
  mdToHtml,
  postContentDir,
  retargetImagePaths,
  toPreviewSrc,
} from '@/utils/markdown'

const route = useRoute()
const router = useRouter()

const isNew = computed(() => route.name === 'post-new')
const file = computed(() => (typeof route.query.file === 'string' ? route.query.file : ''))

const loading = ref(true)
const saving = ref(false)
const loadError = ref('')

const form = reactive({
  title: '',
  description: '',
  date: nowLocal(),
  slug: '',
  path: '',
  category: '',
  tags: [] as string[],
  draft: false,
  cover: '',
  dir: '',
  name: '',
})

const raw = ref<Record<string, unknown>>({})

const original = reactive({ body: '', dir: '', file: '' })

const bodyMarkdown = ref('')
const bodyHtml = ref('')
const bodyDirty = ref(false)
const activeTab = ref<'rich' | 'source'>('rich')

function formSnapshot(): string {
  const text = (value: string | null | undefined) => value ?? ''

  return JSON.stringify([
    text(form.title),
    text(form.description),
    text(form.date),
    text(form.slug),
    text(form.path),
    text(form.category),
    (form.tags ?? []).map(text),
    form.draft === true,
    text(form.cover),
    text(form.dir),
    text(form.name),
  ])
}

const baseline = ref(formSnapshot())
const metaDirty = computed(() => formSnapshot() !== baseline.value)

const editorRef = useTemplateRef<InstanceType<typeof RichTextEditor>>('editor')

const sourceWrapRef = useTemplateRef<HTMLElement>('sourceWrap')

const categories = ref<string[]>([])
const knownTags = ref<string[]>([])
const dirs = ref<string[]>([])
const coverPickerOpen = ref(false)

const otherPosts = ref<Array<{ realPath: string; file: string }>>([])

const nameTouched = ref(false)

function nowLocal(): string {
  return new Date().toLocaleString('sv-SE').slice(0, 16)
}

const dirty = computed(() => bodyDirty.value || metaDirty.value)

const bodyDir = computed(() => postContentDir(original.dir))
const saveDir = computed(() => postContentDir(form.dir))

const realPath = computed(() =>
  form.slug ? `/${['blog', ...form.dir.split('/').filter(Boolean), form.slug].join('/')}` : '',
)

const pathMismatch = computed(
  () => !!form.path && !!realPath.value && form.path !== realPath.value,
)

const slugError = computed(() => {
  if (!form.slug) return '必填：文章 URL 由它生成'
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) return '只能用小写字母、数字和连字符'
  return ''
})

function slugClash(slug: string): string {
  if (!slug) return ''
  const target = `/${['blog', ...form.dir.split('/').filter(Boolean), slug].join('/')}`
  return otherPosts.value.find((p) => p.realPath === target && p.file !== original.file)?.file ?? ''
}

const slugClashWith = computed(() => (slugError.value ? '' : slugClash(form.slug)))

const risks = computed(() => detectRichTextRisks(bodyMarkdown.value))

const categoryOptions = computed(() => categories.value.map((c) => ({ value: c })))
const dirOptions = computed(() => dirs.value.map((d) => ({ value: d })))

function filterOption(input: string, option: { value?: string | number }): boolean {
  return String(option.value ?? '')
    .toLowerCase()
    .includes(input.toLowerCase())
}

const coverPreview = computed(() => (form.cover ? toPreviewSrc(form.cover, bodyDir.value) : ''))

const stats = computed(() => {
  const text = bodyMarkdown.value
  return {
    chars: text.length,
    images: (text.match(/!\[[^\]]*\]\([^)]+\)/g) ?? []).length,
  }
})

watch(
  () => form.title,
  (title) => {
    if (isNew.value && !nameTouched.value) form.name = title.trim()
  },
)

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('beforeunload', onBeforeUnload)

  api
    .aiStatus()
    .then((status) => {
      aiStatus.value = status
    })
    .catch((err: unknown) => {
      aiStatus.value = {
        enabled: false,
        model: '',
        baseUrl: '',
        hint: `取不到 AI 配置：${err instanceof Error ? err.message : String(err)}`,
      }
    })

  try {
    const meta = await api.listPosts()
    categories.value = meta.categories
    knownTags.value = meta.tags
    dirs.value = meta.dirs
    otherPosts.value = meta.posts.map((post) => ({ realPath: post.realPath, file: post.file }))

    if (isNew.value) {
      form.dir = meta.dirs[0] ?? ''
      original.dir = form.dir
      setBody('')
    } else {
      const detail = await api.getPost(file.value)
      fill(detail)
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

function fill(detail: PostDetail) {
  form.title = detail.title
  form.description = detail.description
  form.date = detail.date || nowLocal()
  form.slug = detail.slug
  form.path = detail.path
  form.category = detail.category
  form.tags = [...detail.tags]
  form.draft = detail.draft
  form.cover = detail.cover
  form.dir = detail.dir
  form.name = detail.name

  raw.value = detail.raw
  original.body = detail.body
  original.dir = detail.dir
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
    if (bodyDirty.value) bodyMarkdown.value = htmlToMd(editorRef.value?.getHtml() ?? '', bodyDir.value)
  } else {
    bodyHtml.value = mdToHtml(bodyMarkdown.value, bodyDir.value)
    editorRef.value?.setHtml(bodyHtml.value)
  }
}

function onSourceInput() {
  bodyDirty.value = true
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
  if (slugError.value) {
    message.warning(`slug ${slugError.value}`)
    return
  }
  if (!form.name.trim()) {
    message.warning('文件名不能为空')
    return
  }

  const input: PostInput = {
    title: form.title,
    description: form.description,
    date: form.date,
    slug: form.slug,
    path: form.path,
    category: form.category,
    tags: form.tags,
    draft: form.draft,
    cover: form.cover ? retargetImagePaths(form.cover, bodyDir.value, saveDir.value) : '',
    dir: form.dir,
    name: form.name,
    body: currentBody(),
    raw: raw.value,
  }

  saving.value = true
  try {
    const previousFile = original.file

    const saved = isNew.value
      ? await api.createPost(input)
      : await api.updatePost(previousFile, input)

    message.success(`已保存到 content/${saved.file}`)

    fill(saved)

    if (saved.file !== previousFile) {
      await router.replace({ name: 'post-edit', query: { file: saved.file } })
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  } finally {
    saving.value = false
  }
}

async function remove() {
  try {
    const { trashed } = await api.deletePost(original.file)
    message.success(`已移到 admin/.trash/${trashed}`)
    baseline.value = formSnapshot()
    bodyDirty.value = false
    await router.push({ name: 'posts' })
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

function pickCover(name: string) {
  form.cover = imageMarkdownPath(bodyDir.value, name)
}


const aiStatus = ref<AiStatus>({ enabled: false, model: '', baseUrl: '', hint: '正在读 AI 配置…' })

type AiTarget =
  | { kind: 'rich-range'; from: number; to: number; inline: boolean }
  | { kind: 'rich-all' }
  | { kind: 'source-range'; start: number; end: number }
  | { kind: 'source-all' }

const ai = reactive({
  open: false,
  metaOpen: false,
  loading: false,
  error: '',
  action: 'polish' as AiAction,
  scope: 'all' as AiScope,
  before: '',
  text: null as AiTextResult | null,
  meta: null as AiMetaResult | null,
  target: null as AiTarget | null,
  picked: null as { text: string; target: AiTarget } | null,
})

const rewriteActions = computed(() => AI_ACTIONS.filter((item) => !item.wholeOnly))
const metaActions = computed(() =>
  AI_ACTIONS.filter((item) => item.wholeOnly && item.action !== 'fix'),
)
const fixAction = computed(() => AI_ACTIONS.find((item) => item.action === 'fix'))

const aiFormatOnly = computed(() => ai.action === 'fix')

const scopeOfTarget = (target: AiTarget): AiScope =>
  target.kind === 'rich-range' || target.kind === 'source-range' ? 'selection' : 'all'

function editingMarkdown(): string {
  if (activeTab.value === 'source') return bodyMarkdown.value
  if (!bodyDirty.value) return original.body
  return htmlToMd(editorRef.value?.getHtml() ?? '', bodyDir.value)
}

function sourceTextarea(): HTMLTextAreaElement | null {
  return sourceWrapRef.value?.querySelector('textarea') ?? null
}

function snapshotScope() {
  if (activeTab.value === 'source') {
    const textarea = sourceTextarea()
    const start = textarea?.selectionStart ?? 0
    const end = textarea?.selectionEnd ?? 0

    ai.picked =
      end > start
        ? {
            text: bodyMarkdown.value.slice(start, end),
            target: { kind: 'source-range', start, end },
          }
        : { text: bodyMarkdown.value.trim(), target: { kind: 'source-all' } }
    return
  }

  const selection = editorRef.value?.getSelection()
  ai.picked =
    selection && !selection.empty
      ? {
          text: htmlToMd(selection.html, bodyDir.value).trim(),
          target: {
            kind: 'rich-range',
            from: selection.from,
            to: selection.to,
            inline: selection.inline,
          },
        }
      : { text: editingMarkdown().trim(), target: { kind: 'rich-all' } }
}

const aiScopeTitle = computed(() => {
  const picked = ai.picked
  if (!picked) return '作用范围'
  const chars = picked.text.length
  return scopeOfTarget(picked.target) === 'selection'
    ? `改写选中的 ${chars} 字`
    : `改写全文 ${chars} 字（没选中就是全文）`
})

const aiScopeLabel = computed(() =>
  ai.scope === 'selection' ? `选中的 ${ai.before.length} 字` : `全文 ${ai.before.length} 字`,
)

async function runAi(action: AiAction) {
  if (!ai.picked) snapshotScope()
  const picked = ai.picked
  if (!picked) return

  const isMeta = action === 'meta'
  const wholeOnly = AI_ACTIONS.find((item) => item.action === action)?.wholeOnly === true

  const text = wholeOnly ? editingMarkdown().trim() : picked.text

  if (!text.trim() && !(isMeta && form.title.trim())) {
    message.warning(
      isMeta ? '正文和标题都是空的，AI 没有可依据的东西' : wholeOnly ? '正文是空的' : '选中的内容是空的',
    )
    return
  }

  ai.action = action
  ai.scope = wholeOnly ? 'all' : scopeOfTarget(picked.target)
  ai.before = text
  ai.target = isMeta
    ? null
    : wholeOnly
      ? { kind: activeTab.value === 'source' ? 'source-all' : 'rich-all' }
      : picked.target
  ai.error = ''
  ai.text = null
  ai.meta = null
  ai.loading = true
  if (isMeta) ai.metaOpen = true
  else ai.open = true

  try {
    const result = await api.ai({
      action,
      scope: ai.scope,
      text,
      title: form.title,
      category: form.category,
    })
    if (result.kind === 'meta') ai.meta = result
    else ai.text = result
  } catch (err) {
    ai.error = err instanceof Error ? err.message : String(err)
  } finally {
    ai.loading = false
  }
}

function onAiMenu(info: { key: string | number }) {
  void runAi(String(info.key) as AiAction)
}

function applyAiText(text: string) {
  const target = ai.target
  if (!target) return

  if (target.kind === 'source-range') {
    const body = bodyMarkdown.value
    bodyMarkdown.value = body.slice(0, target.start) + text + body.slice(target.end)
    bodyDirty.value = true
  } else if (target.kind === 'rich-range') {
    const html = mdToHtml(text, bodyDir.value)
    editorRef.value?.replaceRange(
      target.from,
      target.to,
      target.inline ? unwrapSingleParagraph(html) : html,
    )
  } else {
    replaceWholeBody(text)
  }

  ai.open = false
  message.success(
    `已用${actionLabel(ai.action)}结果替换${ai.scope === 'selection' ? '选中部分' : '全文'}，不满意可以 ⌘Z 撤销`,
  )
}

function replaceWholeBody(text: string) {
  if (activeTab.value === 'source') {
    bodyMarkdown.value = replaceBodyKeepEdges(bodyMarkdown.value, text)
    bodyDirty.value = true
  } else {
    editorRef.value?.replaceAll(mdToHtml(text, bodyDir.value))
  }
}

function applyAiMeta(payload: {
  title?: string
  slug?: string
  description?: string
  tags?: string[]
}) {
  if (payload.title !== undefined) form.title = payload.title
  if (payload.slug !== undefined) form.slug = payload.slug
  if (payload.description !== undefined) form.description = payload.description
  if (payload.tags) form.tags = payload.tags

  ai.metaOpen = false

  const filled = [
    payload.title !== undefined ? '标题' : '',
    payload.slug !== undefined ? 'slug' : '',
    payload.description !== undefined ? '描述' : '',
    payload.tags ? '标签' : '',
  ].filter(Boolean)

  message.success(`已填入${filled.join('、')}，记得保存`)
}
</script>

<template>
  <a-spin :spinning="loading">
    <a-alert v-if="loadError" type="error" show-icon :message="loadError" class="load-error" />

    <div class="head">
      <a-button type="text" @click="router.push({ name: 'posts' })">
        <template #icon><ArrowLeftOutlined /></template>
        文章列表
      </a-button>

      <span class="head-title">{{ isNew ? '新文章' : form.title || '（没有标题）' }}</span>
      <a-tag v-if="dirty" color="orange">未保存</a-tag>

      <span class="spacer" />

      <a-popconfirm
        v-if="!isNew"
        title="把这篇文章移到 admin/.trash/？"
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
          placeholder="文章标题"
          size="large"
        />

        <a-alert v-if="risks.length" type="warning" show-icon class="risk">
          <template #message>
            这篇文章里有富文本编辑器撑不住的语法，建议在「Markdown 源码」里改
          </template>
          <template #description>
            <div v-for="risk in risks" :key="risk.label" class="risk-item">
              {{ risk.label }} —— <code>{{ risk.sample }}</code>
            </div>
            富文本标签会把这些结构拍平成纯文字（比如 <code>&lt;details&gt;</code> 折叠块会散掉）。
          </template>
        </a-alert>

        <a-tabs v-model:activeKey="activeTab" @change="onTabChange">
          <template #rightExtra>
            <div class="tab-extra">
              <a-tooltip
                :title="
                  aiStatus.enabled
                    ? '修标题层级、多余转义、代码围栏的语言、垃圾空行。只改 Markdown 标记，一个字都不改'
                    : aiStatus.hint
                "
              >
                <a-button
                  size="small"
                  :disabled="!aiStatus.enabled"
                  :loading="ai.loading && ai.action === 'fix'"
                  @click="runAi('fix')"
                >
                  <template #icon><MedicineBoxOutlined /></template>
                  {{ fixAction?.label ?? '修复格式' }}
                </a-button>
              </a-tooltip>

              <a-tooltip :title="aiStatus.enabled ? '' : aiStatus.hint">
                <a-dropdown
                  :disabled="!aiStatus.enabled"
                  :trigger="['click']"
                  @open-change="(open: boolean) => open && snapshotScope()"
                >
                  <a-button size="small" :loading="ai.loading && ai.action !== 'fix'">
                    <template #icon><HighlightOutlined /></template>
                    AI
                    <DownOutlined />
                  </a-button>

                  <template #overlay>
                    <a-menu @click="onAiMenu">
                      <a-menu-item-group :title="aiScopeTitle">
                        <a-menu-item v-for="item in rewriteActions" :key="item.action">
                          <div class="ai-item">
                            <span>{{ item.label }}</span>
                            <span class="ai-hint">{{ item.hint }}</span>
                          </div>
                        </a-menu-item>
                      </a-menu-item-group>

                      <a-menu-divider />

                      <a-menu-item v-for="item in metaActions" :key="item.action">
                        <div class="ai-item">
                          <span>{{ item.label }}</span>
                          <span class="ai-hint">{{ item.hint }}</span>
                        </div>
                      </a-menu-item>
                    </a-menu>
                  </template>
                </a-dropdown>
              </a-tooltip>
            </div>
          </template>

          <a-tab-pane key="rich" tab="富文本">
            <RichTextEditor v-if="!loading" ref="editor" :html="bodyHtml" @dirty="bodyDirty = true" />
          </a-tab-pane>

          <a-tab-pane key="source" tab="Markdown 源码">
            <div ref="sourceWrap">
              <a-textarea
                v-model:value="bodyMarkdown"
                class="source-input mono"
                :auto-size="{ minRows: 20 }"
                spellcheck="false"
                @input="onSourceInput"
              />
            </div>
            <p class="source-hint">
              这里写的内容会原样存进文件。图片路径按仓库约定写相对路径，比如
              <code>{{ imageMarkdownPath(bodyDir, 'x.png') }}</code>
            </p>
          </a-tab-pane>
        </a-tabs>

        <div class="stats">{{ stats.chars }} 字 · {{ stats.images }} 张图</div>
      </div>

      <aside class="side">
        <a-form layout="vertical" :colon="false">
          <a-form-item
            label="slug"
            :validate-status="slugError ? 'error' : ''"
            :help="slugError || undefined"
          >
            <a-input v-model:value="form.slug" placeholder="free-ai" class="mono-input" />
            <div v-if="slugClashWith" class="field-hint clash">
              和 <span class="mono">{{ slugClashWith }}</span> 撞了，两篇文章的 URL 会一样
            </div>
          </a-form-item>

          <a-form-item label="文章 URL">
            <div class="url-preview mono">{{ realPath || '（先填 slug）' }}</div>
            <a-alert
              v-if="pathMismatch"
              type="warning"
              show-icon
              class="url-warn"
              :message="`frontmatter 里的 path 写的是 ${form.path}`"
              :description="`真实 URL 由 slug 决定，是上面这个。path 字段在 blog 里其实没用上，留着不影响，但两边不一致容易看错。`"
            />
          </a-form-item>

          <a-form-item label="描述">
            <a-textarea
              v-model:value="form.description"
              :auto-size="{ minRows: 2, maxRows: 4 }"
              placeholder="文章的描述"
            />
          </a-form-item>

          <a-form-item label="发布时间">
            <a-date-picker
              v-model:value="form.date"
              :show-time="{ format: 'HH:mm' }"
              format="YYYY-MM-DD HH:mm"
              value-format="YYYY-MM-DD HH:mm"
              placeholder="选择日期和时间"
              style="width: 100%"
            />
          </a-form-item>

          <a-form-item label="分类">
            <a-auto-complete
              v-model:value="form.category"
              placeholder="点击选择分类，或输入一个新分类"
              :options="categoryOptions"
              :filter-option="filterOption"
              allow-clear
            />
          </a-form-item>

          <a-form-item label="标签">
            <a-select
              v-model:value="form.tags"
              mode="tags"
              placeholder="回车添加"
              :options="knownTags.map((t) => ({ value: t }))"
            />
          </a-form-item>

          <a-form-item label="子目录">
            <a-auto-complete
              v-model:value="form.dir"
              placeholder="留空 = content/blog 顶层"
              :options="dirOptions"
              :filter-option="filterOption"
              allow-clear
            />
          </a-form-item>

          <a-form-item label="文件名称">
            <a-input
              v-model:value="form.name"
              addon-after=".md"
              @change="nameTouched = true"
            />
            <div class="field-hint mono">
              content/blog/{{ form.dir ? form.dir + '/' : '' }}{{ form.name || '…' }}.md
            </div>
          </a-form-item>

          <a-form-item label="封面">
            <a-space-compact style="width: 100%">
              <a-input v-model:value="form.cover" placeholder="可留空" />
              <a-button @click="coverPickerOpen = true">
                <template #icon><PictureOutlined /></template>
              </a-button>
            </a-space-compact>
            <img v-if="coverPreview" :src="coverPreview" class="cover-preview" alt="封面预览" />
          </a-form-item>

          <a-form-item>
            <div class="draft-row">
              <a-switch v-model:checked="form.draft" />
              <span>草稿</span>
            </div>
          </a-form-item>
        </a-form>
      </aside>
    </div>

    <ImagePickerModal v-model:open="coverPickerOpen" @select="pickCover($event.name)" />

    <AiActionModal
      v-model:open="ai.open"
      :action-label="actionLabel(ai.action)"
      :scope-label="aiScopeLabel"
      :format-only="aiFormatOnly"
      :loading="ai.loading"
      :error="ai.error"
      :before="ai.before"
      :result="ai.text"
      @apply="applyAiText"
      @retry="runAi(ai.action)"
    />

    <AiMetaModal
      v-model:open="ai.metaOpen"
      :loading="ai.loading"
      :error="ai.error"
      :result="ai.meta"
      :current-title="form.title"
      :current-slug="form.slug"
      :current-description="form.description"
      :current-tags="form.tags"
      :slug-clash="slugClash"
      @apply="applyAiMeta"
      @retry="runAi('meta')"
    />
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

.cover-preview {
  display: block;
  width: 100%;
  margin-top: 8px;
  border-radius: 4px;
}

.draft-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.ant-tabs-content-holder) {
  min-width: 0;
}

.ai-item {
  display: flex;
  flex-direction: column;
  line-height: 1.5;
}

.tab-extra {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ai-hint {
  color: #8c8c8c;
  font-size: 12px;
}

.clash {
  color: #d46b08;
}
</style>
