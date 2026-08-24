<script setup lang="ts">
/**
 * tiptap 富文本编辑器 + 工具条。
 *
 * 和外面的约定：这个组件只认 HTML，图片一律用 `/blog-public/...` 预览地址（和文章
 * 所在目录无关）。Markdown 的转换、相对路径的换算都在父组件做（见 utils/markdown.ts）。
 *
 * 内容同步刻意做成「拉」而不是「推」：每敲一个字都 getHTML() 再转 Markdown 太浪费，
 * 所以只在真正需要的时候（切标签、保存）由父组件调 `getHtml()` 取一次，
 * 期间只往上报一个 dirty 信号。
 */
import { computed, ref } from 'vue'
import { EditorContent, getHTMLFromFragment, useEditor } from '@tiptap/vue-3'
import { message } from 'ant-design-vue'
import {
  BoldOutlined,
  CodeOutlined,
  ItalicOutlined,
  LinkOutlined,
  OrderedListOutlined,
  PictureOutlined,
  RedoOutlined,
  StrikethroughOutlined,
  TableOutlined,
  UndoOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons-vue'

import { api } from '@/api'
import { createEditorExtensions } from '@/editor/extensions'
import ImagePickerModal from './ImagePickerModal.vue'

const props = defineProps<{ html: string }>()
const emit = defineEmits<{ dirty: [] }>()

const uploading = ref(false)
const pickerOpen = ref(false)
const linkOpen = ref(false)
const linkHref = ref('')

const editor = useEditor({
  content: props.html,
  extensions: createEditorExtensions(),
  onUpdate: () => emit('dirty'),
  editorProps: {
    attributes: { class: 'tiptap' },

    // 粘贴：剪贴板里有图就走上传，其余交给 tiptap 默认处理
    handlePaste: (_view, event) => {
      const files = imageFilesOf(event.clipboardData?.files)
      if (!files.length) return false
      void uploadAndInsert(files)
      return true
    },

    // 拖拽：插到鼠标落点，而不是当前光标处
    handleDrop: (view, event) => {
      const dragEvent = event as DragEvent
      const files = imageFilesOf(dragEvent.dataTransfer?.files)
      if (!files.length) return false

      const at = view.posAtCoords({ left: dragEvent.clientX, top: dragEvent.clientY })
      void uploadAndInsert(files, at?.pos)
      return true
    },
  },
})

/**
 * 当前选区。给 AI 改写用：父组件要知道「选了什么」「能不能行内插回去」。
 *
 * `inline` 的意思是选区起止落在同一个文本块里（在一个段落中间选了半句话）。
 * 这个信息必须在这里算 —— 出了这个组件就只剩 HTML 字符串，
 * 「这段 HTML 原来是半个段落还是三个段落」就分不出来了，而插回去的方式完全不同。
 *
 * 不 export：`<script setup>` 不能有 ES 导出，而父组件通过
 * `InstanceType<typeof RichTextEditor>` 拿到的方法签名本来就带着这个结构类型。
 */
interface EditorSelection {
  empty: boolean
  /** ProseMirror 文档位置，替换时原样传回来 */
  from: number
  to: number
  inline: boolean
  html: string
  /** 纯文本，只用来数字数给界面显示 */
  text: string
}

defineExpose({
  /** 取当前 HTML。父组件在切标签和保存时调 */
  getHtml: () => editor.value?.getHTML() ?? '',
  /** 外部（Markdown 源码标签）改完内容后灌回来。不触发 dirty */
  setHtml: (html: string) => editor.value?.commands.setContent(html, { emitUpdate: false }),
  focus: () => editor.value?.commands.focus(),

  getSelection: (): EditorSelection => {
    const instance = editor.value
    if (!instance) return { empty: true, from: 0, to: 0, inline: false, html: '', text: '' }

    const { from, to, empty, $from, $to } = instance.state.selection
    return {
      empty,
      from,
      to,
      inline: $from.sameParent($to),
      html: empty
        ? ''
        : getHTMLFromFragment(instance.state.doc.slice(from, to).content, instance.schema),
      text: instance.state.doc.textBetween(from, to, '\n'),
    }
  },

  /**
   * 替换一段内容。
   *
   * 用 `insertContentAt` 而不是 `setContent`：前者是一次普通事务，会进 undo 历史，
   * 所以 AI 改完不满意能直接 ⌘Z 回去 —— 这是「敢让 AI 动正文」的前提。
   */
  replaceRange: (from: number, to: number, html: string) => {
    editor.value?.chain().focus().insertContentAt({ from, to }, html).run()
  },

  /** 换掉整篇正文。同样走事务，可撤销 */
  replaceAll: (html: string) => {
    const instance = editor.value
    if (!instance) return
    instance
      .chain()
      .focus()
      .insertContentAt({ from: 0, to: instance.state.doc.content.size }, html)
      .run()
  },
})

function imageFilesOf(list: FileList | null | undefined): File[] {
  return [...(list ?? [])].filter((file) => file.type.startsWith('image/'))
}

/**
 * 截图粘贴过来的 File 名字往往是空的或者一律叫 image.png，直接用会全撞在一起。
 * 按仓库里已有的习惯（Obsidian 的 `Pasted image 20260819182328.png`）生成时间戳名字。
 */
function nameFor(file: File): string {
  const generic = !file.name || /^(image|screenshot|clipboard)\.\w+$/i.test(file.name)
  if (!generic) return file.name

  const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png'
  const stamp = new Date()
    .toLocaleString('sv-SE', { hour12: false })
    .replace(/[-: ]/g, '')
  return `Pasted-image-${stamp}.${ext}`
}

async function uploadAndInsert(files: File[], pos?: number) {
  uploading.value = true
  try {
    for (const file of files) {
      const { image, reused } = await api.uploadImage(nameFor(file), file)
      insertImage(image.previewUrl, pos)
      message.success(
        reused ? `复用了已有的 ${image.name}` : `已存到 public/images/${image.name}`,
      )
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  } finally {
    uploading.value = false
  }
}

function insertImage(src: string, pos?: number) {
  const chain = editor.value?.chain().focus()
  if (!chain) return
  if (pos === undefined) chain.setImage({ src }).run()
  else chain.insertContentAt(pos, { type: 'image', attrs: { src } }).run()
}

/** 工具条按钮：把 chain().focus() 这段样板收在一处 */
const cmd = {
  bold: () => editor.value?.chain().focus().toggleBold().run(),
  italic: () => editor.value?.chain().focus().toggleItalic().run(),
  strike: () => editor.value?.chain().focus().toggleStrike().run(),
  code: () => editor.value?.chain().focus().toggleCode().run(),
  bulletList: () => editor.value?.chain().focus().toggleBulletList().run(),
  orderedList: () => editor.value?.chain().focus().toggleOrderedList().run(),
  blockquote: () => editor.value?.chain().focus().toggleBlockquote().run(),
  codeBlock: () => editor.value?.chain().focus().toggleCodeBlock().run(),
  hr: () => editor.value?.chain().focus().setHorizontalRule().run(),
  undo: () => editor.value?.chain().focus().undo().run(),
  redo: () => editor.value?.chain().focus().redo().run(),
  clear: () => editor.value?.chain().focus().unsetAllMarks().clearNodes().run(),
  table: () =>
    editor.value?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  addRow: () => editor.value?.chain().focus().addRowAfter().run(),
  addCol: () => editor.value?.chain().focus().addColumnAfter().run(),
  delRow: () => editor.value?.chain().focus().deleteRow().run(),
  delCol: () => editor.value?.chain().focus().deleteColumn().run(),
  delTable: () => editor.value?.chain().focus().deleteTable().run(),
}

/** 段落级别：正文 / H1–H4（blog 文章里 H5、H6 也有，所以给到 6） */
const blockLevel = computed({
  get: () => {
    for (const level of [1, 2, 3, 4, 5, 6] as const) {
      if (editor.value?.isActive('heading', { level })) return `h${level}`
    }
    return 'p'
  },
  set: (value: string) => {
    const chain = editor.value?.chain().focus()
    if (!chain) return
    if (value === 'p') chain.setParagraph().run()
    else chain.setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6 }).run()
  },
})

const blockOptions = [
  { value: 'p', label: '正文' },
  { value: 'h1', label: '标题 1' },
  { value: 'h2', label: '标题 2' },
  { value: 'h3', label: '标题 3' },
  { value: 'h4', label: '标题 4' },
  { value: 'h5', label: '标题 5' },
  { value: 'h6', label: '标题 6' },
]

const isActive = (name: string, attrs?: Record<string, unknown>) =>
  editor.value?.isActive(name, attrs) ?? false

function openLink() {
  linkHref.value = (editor.value?.getAttributes('link').href as string) ?? ''
  linkOpen.value = true
}

function applyLink() {
  const href = linkHref.value.trim()
  const chain = editor.value?.chain().focus().extendMarkRange('link')
  if (!chain) return

  if (href) chain.setLink({ href }).run()
  else chain.unsetLink().run()

  linkOpen.value = false
}
</script>

<template>
  <div class="editor-shell">
    <div class="toolbar">
      <a-select
        v-model:value="blockLevel"
        class="block-select"
        size="small"
        :options="blockOptions"
      />

      <a-divider type="vertical" />

      <a-tooltip title="加粗 ⌘B">
        <a-button size="small" :type="isActive('bold') ? 'primary' : 'text'" @click="cmd.bold">
          <template #icon><BoldOutlined /></template>
        </a-button>
      </a-tooltip>
      <a-tooltip title="斜体 ⌘I">
        <a-button size="small" :type="isActive('italic') ? 'primary' : 'text'" @click="cmd.italic">
          <template #icon><ItalicOutlined /></template>
        </a-button>
      </a-tooltip>
      <a-tooltip title="删除线">
        <a-button size="small" :type="isActive('strike') ? 'primary' : 'text'" @click="cmd.strike">
          <template #icon><StrikethroughOutlined /></template>
        </a-button>
      </a-tooltip>
      <a-tooltip title="行内代码">
        <a-button size="small" :type="isActive('code') ? 'primary' : 'text'" @click="cmd.code">
          <template #icon><CodeOutlined /></template>
        </a-button>
      </a-tooltip>
      <a-tooltip title="链接">
        <a-button size="small" :type="isActive('link') ? 'primary' : 'text'" @click="openLink">
          <template #icon><LinkOutlined /></template>
        </a-button>
      </a-tooltip>

      <a-divider type="vertical" />

      <a-tooltip title="无序列表">
        <a-button
          size="small"
          :type="isActive('bulletList') ? 'primary' : 'text'"
          @click="cmd.bulletList"
        >
          <template #icon><UnorderedListOutlined /></template>
        </a-button>
      </a-tooltip>
      <a-tooltip title="有序列表">
        <a-button
          size="small"
          :type="isActive('orderedList') ? 'primary' : 'text'"
          @click="cmd.orderedList"
        >
          <template #icon><OrderedListOutlined /></template>
        </a-button>
      </a-tooltip>
      <a-button
        size="small"
        :type="isActive('blockquote') ? 'primary' : 'text'"
        @click="cmd.blockquote"
      >
        引用
      </a-button>
      <a-button
        size="small"
        :type="isActive('codeBlock') ? 'primary' : 'text'"
        @click="cmd.codeBlock"
      >
        代码块
      </a-button>
      <a-button size="small" type="text" @click="cmd.hr">分割线</a-button>

      <a-divider type="vertical" />

      <a-tooltip title="插入表格（带表头）">
        <a-button size="small" type="text" @click="cmd.table">
          <template #icon><TableOutlined /></template>
        </a-button>
      </a-tooltip>
      <a-tooltip title="插入图片">
        <a-button size="small" type="text" :loading="uploading" @click="pickerOpen = true">
          <template #icon><PictureOutlined /></template>
        </a-button>
      </a-tooltip>

      <span class="spacer" />

      <a-button size="small" type="text" @click="cmd.clear">清除格式</a-button>
      <a-tooltip title="撤销 ⌘Z">
        <a-button size="small" type="text" @click="cmd.undo">
          <template #icon><UndoOutlined /></template>
        </a-button>
      </a-tooltip>
      <a-tooltip title="重做 ⇧⌘Z">
        <a-button size="small" type="text" @click="cmd.redo">
          <template #icon><RedoOutlined /></template>
        </a-button>
      </a-tooltip>
    </div>

    <!-- 表格操作只在光标落在表格里时出现，平时不占地方 -->
    <div v-if="isActive('table')" class="toolbar table-toolbar">
      <span class="table-label">表格</span>
      <a-button size="small" type="text" @click="cmd.addRow">加一行</a-button>
      <a-button size="small" type="text" @click="cmd.addCol">加一列</a-button>
      <a-button size="small" type="text" @click="cmd.delRow">删除行</a-button>
      <a-button size="small" type="text" @click="cmd.delCol">删除列</a-button>
      <a-button size="small" type="text" danger @click="cmd.delTable">删除整个表格</a-button>
    </div>

    <EditorContent :editor="editor" class="editor-body" />

    <ImagePickerModal v-model:open="pickerOpen" @select="insertImage($event.previewUrl)" />

    <a-modal
      v-model:open="linkOpen"
      title="链接"
      ok-text="确定"
      cancel-text="取消"
      @ok="applyLink"
    >
      <a-input
        v-model:value="linkHref"
        placeholder="https://… 或 /blog/xxx（留空则取消链接）"
        @press-enter="applyLink"
      />
    </a-modal>
  </div>
</template>

<style scoped>
.editor-shell {
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  overflow: hidden;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  padding: 6px 8px;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
}

.table-toolbar {
  background: #fff;
}

.table-label {
  margin-right: 6px;
  color: #8c8c8c;
  font-size: 12px;
}

.block-select {
  width: 96px;
}

.spacer {
  flex: 1;
}

.editor-body {
  max-height: calc(100vh - 320px);
  overflow-y: auto;
}
</style>
