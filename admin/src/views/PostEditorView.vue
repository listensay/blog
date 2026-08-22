<script setup lang="ts">
/**
 * 编辑页：左边正文（富文本 / Markdown 源码两个标签），右边 frontmatter 表单。
 *
 * 三条刻意的行为，都是为了「后台不要偷偷改我的文章」：
 *
 * 1. **正文没动过就原样写回**。只改分类、改标签、改日期的时候，正文一个字节都不重排
 *    （富文本往返会把表格空格、列表符号规范化，虽然渲染一样，但 git diff 会很脏）。
 * 2. **换目录时重定向图片路径**。相对路径的 `../` 层数跟文章所在目录绑定，
 *    从 ai/ 挪到顶层不改路径的话，线上图片会全部 404（构建期只有一行 warn）。
 * 3. **富文本吃不下的语法先警告**。正文里有裸 HTML 之类的东西时默认停在源码标签，
 *    免得进富文本一转把 `<details>` 拍平成纯文字。
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, useTemplateRef, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import { ArrowLeftOutlined, DeleteOutlined, PictureOutlined, SaveOutlined } from '@ant-design/icons-vue'

import { api } from '@/api'
import ImagePickerModal from '@/components/ImagePickerModal.vue'
import RichTextEditor from '@/components/RichTextEditor.vue'
import type { PostDetail, PostInput } from '@/types'
import {
  detectRichTextRisks,
  htmlToMd,
  imageMarkdownPath,
  mdToHtml,
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

/** 表单字段。date 用字符串（DatePicker 的 value-format 支持），不碰 dayjs 对象 */
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

/** 保存时要原样带回去的整份原文 frontmatter（服务端靠它保住未知字段和空键） */
const raw = ref<Record<string, unknown>>({})

/** 打开时的原始正文和目录。判断「正文动没动」和「要不要重定向图片」都靠它 */
const original = reactive({ body: '', dir: '', file: '' })

const bodyMarkdown = ref('')
const bodyHtml = ref('')
const bodyDirty = ref(false)
const activeTab = ref<'rich' | 'source'>('rich')

/**
 * 「改过没有」用**快照比对**判断，而不是监听表单变化。
 *
 * 之前用 `watch(() => ({ ...form }))` + 一个 `loading` 开关来过滤加载期间的赋值，
 * 结果是：watcher 默认在下一个 tick 才执行，那时 `loading` 已经落回 false，
 * 于是每打开一篇文章都立刻被标成「未保存」，什么都没改也会弹「改动会丢掉」。
 *
 * 比对快照就完全不依赖时序，顺带还有个好处：手动把值改回去之后又变回「干净」。
 */
function formSnapshot(): string {
  // 归一化成字符串再比：antd 的输入类组件在清空时可能给回 undefined 而不是空串，
  // 不归一化的话「空 → 清空」这种没有实际变化的动作也会被算成改动
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

/** 加载完 / 保存完时的表单快照 */
const baseline = ref(formSnapshot())
const metaDirty = computed(() => formSnapshot() !== baseline.value)

const editorRef = useTemplateRef<InstanceType<typeof RichTextEditor>>('editor')

const categories = ref<string[]>([])
const knownTags = ref<string[]>([])
const dirs = ref<string[]>([])
const coverPickerOpen = ref(false)

/** 文件名默认跟着标题走，用户手改过之后就不再自动跟随 */
const nameTouched = ref(false)

function nowLocal(): string {
  // sv-SE 的 toLocaleString 就是 `YYYY-MM-DD HH:mm:ss`，切掉秒即可，不用引 dayjs
  return new Date().toLocaleString('sv-SE').slice(0, 16)
}

const dirty = computed(() => bodyDirty.value || metaDirty.value)

/** blog 的 slug-path transformer 真正会生成的 URL */
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

const risks = computed(() => detectRichTextRisks(bodyMarkdown.value))

/*
 * 分类和子目录用 a-auto-complete 而不是 a-select：这两个字段既要能选已有的，
 * 也要能直接敲一个新的。a-select 想支持自由输入只有 `mode="combobox"`，
 * 而那在 ant-design-vue 4 里已经是内部 API（类型上叫 SECRET_COMBOBOX_MODE_DO_NOT_USE）。
 */
const categoryOptions = computed(() => categories.value.map((c) => ({ value: c })))
const dirOptions = computed(() => dirs.value.map((d) => ({ value: d })))

/** AutoComplete 的候选过滤：不区分大小写的包含匹配 */
function filterOption(input: string, option: { value?: string | number }): boolean {
  return String(option.value ?? '')
    .toLowerCase()
    .includes(input.toLowerCase())
}

const coverPreview = computed(() => (form.cover ? toPreviewSrc(form.cover, form.dir) : ''))

const stats = computed(() => {
  const text = bodyMarkdown.value
  return {
    chars: text.length,
    images: (text.match(/!\[[^\]]*\]\([^)]+\)/g) ?? []).length,
  }
})

// 文件名跟着标题走（新文章、且用户没手动改过文件名时）。中文文件名是这个仓库的约定
watch(
  () => form.title,
  (title) => {
    if (isNew.value && !nameTouched.value) form.name = title.trim()
  },
)

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('beforeunload', onBeforeUnload)

  try {
    const meta = await api.listPosts()
    categories.value = meta.categories
    knownTags.value = meta.tags
    dirs.value = meta.dirs

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
    // 新文章那条分支没走 fill()，这里补一次基准（fill() 自己会更新基准）
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

  // 以磁盘上的这份内容作为「没改动」的基准
  baseline.value = formSnapshot()

  // 正文里有富文本撑不住的语法时，默认停在源码标签
  if (detectRichTextRisks(detail.body).length) activeTab.value = 'source'
}

function setBody(markdown: string) {
  bodyMarkdown.value = markdown
  bodyHtml.value = mdToHtml(markdown, form.dir)
  bodyDirty.value = false
}

/** 切标签时把内容同步过去，以当前标签的内容为准 */
function onTabChange(key: string | number) {
  if (key === 'source') {
    // 富文本 → 源码：只有真编辑过才重新序列化，没动过就保留原文
    if (bodyDirty.value) bodyMarkdown.value = htmlToMd(editorRef.value?.getHtml() ?? '', form.dir)
  } else {
    bodyHtml.value = mdToHtml(bodyMarkdown.value, form.dir)
    editorRef.value?.setHtml(bodyHtml.value)
  }
}

function onSourceInput() {
  bodyDirty.value = true
}

/** 当前要写进文件的正文 */
function currentBody(): string {
  let body: string

  if (!bodyDirty.value) {
    body = original.body // 没动过：逐字节保留
  } else if (activeTab.value === 'rich') {
    body = htmlToMd(editorRef.value?.getHtml() ?? '', form.dir)
  } else {
    body = bodyMarkdown.value
  }

  // 换了目录 → 图片相对路径要跟着改层数。
  // 富文本序列化出来的路径已经按新目录算过了，只有「原样保留」的分支需要补这一步
  if (!bodyDirty.value && original.dir !== form.dir) {
    body = retargetImagePaths(body, original.dir, form.dir)
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
    // 封面也可能因为换目录要重定向
    cover: form.cover ? retargetImagePaths(form.cover, original.dir, form.dir) : '',
    dir: form.dir,
    name: form.name,
    body: currentBody(),
    raw: raw.value,
  }

  saving.value = true
  try {
    // fill() 会把 original.file 改成新路径，所以先把旧路径存下来再比
    const previousFile = original.file

    const saved = isNew.value
      ? await api.createPost(input)
      : await api.updatePost(previousFile, input)

    message.success(`已保存到 content/${saved.file}`)

    // 保存后以磁盘上的真实内容为准重置状态（fill 会把基准也一起更新），
    // 接着编辑不会带着旧的脏标记
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
    // 文章已经不在了，别再拦着离开
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
  // 封面存的也是相对路径，写法和正文图片一致
  form.cover = imageMarkdownPath(form.dir, name)
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
          <a-tab-pane key="rich" tab="富文本">
            <!--
              v-if 等数据到位再挂载。文章是异步读回来的，如果一开始就挂上，
              编辑器会拿着空内容创建，之后 bodyHtml 变了它也不会跟着变
              （刻意不给 html 加 watch：那样每次保存后编辑器都会重建，光标会跳回开头）。
            -->
            <RichTextEditor v-if="!loading" ref="editor" :html="bodyHtml" @dirty="bodyDirty = true" />
          </a-tab-pane>

          <a-tab-pane key="source" tab="Markdown 源码">
            <a-textarea
              v-model:value="bodyMarkdown"
              class="source-input mono"
              :auto-size="{ minRows: 20 }"
              spellcheck="false"
              @input="onSourceInput"
            />
            <p class="source-hint">
              这里写的内容会原样存进文件。图片路径按仓库约定写相对路径，比如
              <code>{{ imageMarkdownPath(form.dir, 'x.png') }}</code>
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
              placeholder="列表页和 SEO 会用到"
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
            <div class="field-hint">
              只写了日期的老文章按 00:00 显示；不动它就不会改写原来那一行
            </div>
          </a-form-item>

          <a-form-item label="分类">
            <a-auto-complete
              v-model:value="form.category"
              placeholder="选已有的或直接写新的"
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
            <div class="field-hint">目录只影响文件放在哪，也会出现在文章 URL 里</div>
          </a-form-item>

          <a-form-item label="文件名">
            <a-input
              v-model:value="form.name"
              addon-after=".md"
              placeholder="可以用中文"
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
            <div class="field-hint">
              草稿不会出现在列表页和 RSS 里；线上直接访问 URL 也是 404，本地 dev 能预览
            </div>
          </a-form-item>
        </a-form>
      </aside>
    </div>

    <ImagePickerModal v-model:open="coverPickerOpen" @select="pickCover($event.name)" />
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

/* 标签页内容和编辑器之间不要再留一层空白 */
:deep(.ant-tabs-content-holder) {
  min-width: 0;
}
</style>
