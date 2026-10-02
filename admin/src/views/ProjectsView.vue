<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import {
  AppstoreOutlined,
  DownOutlined,
  PictureOutlined,
  PlusOutlined,
  ReloadOutlined,
  UpOutlined,
} from '@ant-design/icons-vue'
import { api } from '@/api'
import ImagePickerModal from '@/components/ImagePickerModal.vue'
import { toSitePreviewSrc } from '@/utils/markdown'
import type { Project, ProjectsResponse } from '../../../app/types/project'

const items = ref<Project[]>([])
const revision = ref('')
const loading = ref(true)
const saving = ref(false)
const loadError = ref('')
const keyword = ref('')
const status = ref('all')
const editing = ref<Project | null>(null)
const editingBaseline = ref('')
const isNew = ref(false)
const pickerOpen = ref(false)
const editorError = ref('')
const ready = computed(() => !loading.value && !saving.value && !loadError.value)
const dirty = computed(
  () => !!editing.value && JSON.stringify(editing.value) !== editingBaseline.value,
)
const publishedCount = computed(() => items.value.filter((item) => !item.draft).length)
const filtering = computed(() => !!keyword.value.trim() || status.value !== 'all')
const filtered = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return items.value.filter(
    (item) =>
      (status.value === 'all' || (status.value === 'draft' ? item.draft : !item.draft)) &&
      (!query ||
        [item.title, item.titleEn, item.description, item.descriptionEn, ...item.tags]
          .join(' ')
          .toLowerCase()
          .includes(query)),
  )
})

function fill(data: ProjectsResponse) {
  items.value = data.items
  revision.value = data.revision
}

async function load() {
  if (saving.value) return
  loading.value = true
  loadError.value = ''
  try {
    fill(await api.getProjects())
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

function edit(item?: Project) {
  isNew.value = !item
  editing.value = item
    ? { ...item, tags: [...item.tags] }
    : {
        id: crypto.randomUUID(),
        title: '',
        titleEn: '',
        description: '',
        descriptionEn: '',
        cover: '',
        tags: [],
        demoUrl: '',
        repoUrl: '',
        draft: true,
      }
  editingBaseline.value = JSON.stringify(editing.value)
  editorError.value = ''
}

async function persist(next: Project[]): Promise<boolean> {
  if (!ready.value) return false
  saving.value = true
  try {
    fill(await api.saveProjects(next, revision.value))
    return true
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    if (editing.value) editorError.value = detail
    else message.error(detail)
    return false
  } finally {
    saving.value = false
  }
}

async function saveEditor() {
  if (!editing.value || !ready.value) return
  editorError.value = ''
  if (!editing.value.title.trim()) {
    editorError.value = '请填写作品名称'
    return
  }
  const item = { ...editing.value, tags: [...editing.value.tags] }
  const next = isNew.value
    ? [...items.value, item]
    : items.value.map((current) => (current.id === item.id ? item : current))
  if (await persist(next)) {
    editing.value = null
    message.success(item.draft ? '作品已保存为草稿' : '作品已保存为发布状态')
  }
}

function confirmDiscard(): Promise<boolean> {
  return new Promise((resolve) => {
    Modal.confirm({
      title: '放弃未保存的作品修改？',
      content: '已保存的作品不受影响。',
      okText: '放弃修改',
      okType: 'danger',
      cancelText: '继续编辑',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
}

async function closeEditor() {
  if (saving.value) return
  if (dirty.value && !(await confirmDiscard())) return
  editing.value = null
  pickerOpen.value = false
}

async function move(id: string, delta: number) {
  if (!ready.value || filtering.value) return
  const index = items.value.findIndex((item) => item.id === id)
  const target = index + delta
  if (index < 0 || target < 0 || target >= items.value.length) return
  const next = [...items.value]
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  if (await persist(next)) message.success('展示顺序已保存')
}

async function toggle(item: Project) {
  if (
    await persist(
      items.value.map((current) =>
        current.id === item.id ? { ...current, draft: !current.draft } : current,
      ),
    )
  ) {
    message.success(item.draft ? '作品已设为发布状态' : '作品已撤为草稿')
  }
}

async function remove(item: Project) {
  if (await persist(items.value.filter((current) => current.id !== item.id)))
    message.success('作品已删除，原数据已备份')
}

function pickCover(name: string) {
  if (editing.value) editing.value.cover = `/images/${encodeURIComponent(name)}`
}

function onKeydown(event: KeyboardEvent) {
  if (editing.value && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    if (!pickerOpen.value) void saveEditor()
  }
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value || saving.value) event.preventDefault()
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
onBeforeRouteLeave(async () => {
  if (saving.value) {
    message.info('正在保存，请稍候')
    return false
  }
  return !dirty.value || (await confirmDiscard())
})
</script>

<template>
  <section>
    <div class="head">
      <div>
        <h1>作品管理</h1>
        <p>
          共 {{ items.length }} 个作品 · {{ publishedCount }} 个已发布 ·
          {{ items.length - publishedCount }} 个草稿
        </p>
      </div>
      <a-space>
        <a-button :loading="loading" :disabled="saving" @click="load"
          ><template #icon><ReloadOutlined /></template>刷新</a-button
        >
        <a-button type="primary" :disabled="!ready" @click="edit()"
          ><template #icon><PlusOutlined /></template>新增作品</a-button
        >
      </a-space>
    </div>

    <a-alert v-if="loadError" type="error" show-icon :message="loadError" class="banner" />
    <a-alert
      type="info"
      show-icon
      message="已发布作品展示在博客的「作品」页；保存后本地预览自动更新，线上展示需重新部署。"
      class="banner"
    />

    <div class="panel">
      <div class="filters">
        <a-input-search
          v-model:value="keyword"
          placeholder="搜索作品名称、简介或技术标签"
          aria-label="搜索作品"
          allow-clear
          class="search"
        />
        <a-radio-group v-model:value="status" button-style="solid" aria-label="作品状态筛选">
          <a-radio-button value="all">全部</a-radio-button>
          <a-radio-button value="published">已发布</a-radio-button>
          <a-radio-button value="draft">草稿</a-radio-button>
        </a-radio-group>
      </div>
      <p class="hint">
        列表顺序即前台展示顺序。{{
          filtering ? '清除搜索和状态筛选后可调整顺序。' : '使用上下箭头调整，修改即时保存。'
        }}
      </p>
      <a-spin :spinning="loading || saving">
        <a-empty
          v-if="!filtered.length && !loading && !loadError"
          :description="items.length ? '没有符合条件的作品' : '还没有作品，添加你的第一个项目吧'"
          class="empty"
        >
          <a-button v-if="!items.length" type="primary" :disabled="!ready" @click="edit()"
            >新增作品</a-button
          >
        </a-empty>
        <ul v-else class="project-list">
          <li v-for="item in filtered" :key="item.id" class="project-row">
            <div class="cover">
              <img
                v-if="item.cover"
                :src="toSitePreviewSrc(item.cover)"
                :alt="item.title"
                loading="lazy"
              />
              <AppstoreOutlined v-else />
            </div>
            <div class="project-info">
              <div class="title-line">
                <strong>{{ item.title }}</strong
                ><a-tag :color="item.draft ? 'default' : 'green'">{{
                  item.draft ? '草稿' : '已发布'
                }}</a-tag>
              </div>
              <p class="description">{{ item.description || '暂无简介' }}</p>
              <div class="tags">
                <a-tag v-for="tag in item.tags" :key="tag">{{ tag }}</a-tag>
              </div>
            </div>
            <div class="actions">
              <a-space size="small">
                <a-button
                  size="small"
                  aria-label="上移作品"
                  title="上移"
                  :disabled="!ready || filtering || item.id === items[0]?.id"
                  @click="move(item.id, -1)"
                  ><UpOutlined
                /></a-button>
                <a-button
                  size="small"
                  aria-label="下移作品"
                  title="下移"
                  :disabled="!ready || filtering || item.id === items[items.length - 1]?.id"
                  @click="move(item.id, 1)"
                  ><DownOutlined
                /></a-button>
              </a-space>
              <a-space size="small">
                <a-button type="link" :disabled="!ready" @click="edit(item)">编辑</a-button>
                <a-button type="link" :disabled="!ready" @click="toggle(item)">{{
                  item.draft ? '发布' : '撤为草稿'
                }}</a-button>
                <a-popconfirm
                  :title="`删除「${item.title}」？`"
                  description="原数据会保留备份。"
                  ok-text="删除"
                  cancel-text="取消"
                  @confirm="remove(item)"
                >
                  <a-button type="link" danger :disabled="!ready">删除</a-button>
                </a-popconfirm>
              </a-space>
            </div>
          </li>
        </ul>
      </a-spin>
    </div>

    <a-modal
      :open="!!editing"
      :title="isNew ? '新增作品' : '编辑作品'"
      width="760px"
      :confirm-loading="saving"
      :closable="!saving"
      :keyboard="!saving"
      :mask-closable="false"
      :cancel-button-props="{ disabled: saving }"
      ok-text="保存作品"
      cancel-text="取消"
      @ok="saveEditor"
      @cancel="closeEditor"
    >
      <a-form v-if="editing" :model="editing" layout="vertical" :disabled="saving" class="editor">
        <a-alert v-if="editorError" type="error" show-icon :message="editorError" class="banner" />
        <div class="form-grid">
          <a-form-item name="title" label="作品名称" required
            ><a-input v-model:value="editing.title" :maxlength="100" placeholder="为作品起一个名字"
          /></a-form-item>
          <a-form-item name="titleEn" label="英文名称（选填）"
            ><a-input
              v-model:value="editing.titleEn"
              :maxlength="100"
              placeholder="英文站展示，留空使用中文"
          /></a-form-item>
        </div>
        <a-form-item name="description" label="简介"
          ><a-textarea
            v-model:value="editing.description"
            :rows="3"
            :maxlength="1000"
            show-count
            placeholder="介绍作品的用途、特点与实现"
        /></a-form-item>
        <a-form-item name="descriptionEn" label="英文简介（选填）"
          ><a-textarea
            v-model:value="editing.descriptionEn"
            :rows="2"
            :maxlength="1000"
            placeholder="英文站展示，留空使用中文"
        /></a-form-item>
        <a-form-item name="cover" label="封面">
          <a-space-compact style="width: 100%">
            <a-input v-model:value="editing.cover" placeholder="/images/project.png 或 https://…" />
            <a-button @click="pickerOpen = true"
              ><template #icon><PictureOutlined /></template>选择 / 上传</a-button
            >
          </a-space-compact>
          <img
            v-if="editing.cover"
            :src="toSitePreviewSrc(editing.cover)"
            alt="作品封面预览"
            class="cover-preview"
          />
        </a-form-item>
        <a-form-item name="tags" label="技术标签" extra="输入后按回车添加，最多 20 个标签。">
          <a-select
            v-model:value="editing.tags"
            mode="tags"
            :token-separators="[',', '，']"
            placeholder="例如 Vue、TypeScript、设计"
            :options="[...new Set(items.flatMap((item) => item.tags))].map((value) => ({ value }))"
          />
        </a-form-item>
        <div class="form-grid">
          <a-form-item name="demoUrl" label="演示链接"
            ><a-input v-model:value="editing.demoUrl" placeholder="https://example.com 或 /about"
          /></a-form-item>
          <a-form-item name="repoUrl" label="源码链接"
            ><a-input v-model:value="editing.repoUrl" placeholder="https://github.com/…"
          /></a-form-item>
        </div>
        <a-form-item name="draft" label="发布状态" class="publish-field">
          <a-switch
            :checked="!editing.draft"
            checked-children="发布"
            un-checked-children="草稿"
            @change="(value) => editing && (editing.draft = !value)"
          />
          <span class="hint publish-hint">{{
            editing.draft ? '草稿仅在后台可见。' : '保存后加入前台作品列表。'
          }}</span>
        </a-form-item>
      </a-form>
    </a-modal>
    <ImagePickerModal v-model:open="pickerOpen" @select="pickCover($event.name)" />
  </section>
</template>

<style scoped>
.head,
.filters,
.title-line {
  display: flex;
  align-items: center;
  gap: 12px;
}
.head {
  justify-content: space-between;
  margin-bottom: 20px;
}
h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}
.head p {
  margin: 6px 0 0;
  color: #8c8c8c;
  font-size: 13px;
}
.banner {
  margin-bottom: 16px;
}
.panel {
  padding: 20px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  background: #fff;
}
.filters {
  flex-wrap: wrap;
  justify-content: space-between;
}
.search {
  width: 340px;
  max-width: 100%;
}
.hint {
  color: #8c8c8c;
  font-size: 12px;
}
.empty {
  padding: 40px 0;
}
.project-list {
  list-style: none;
  padding: 0;
  margin: 20px 0 0;
}
.project-row {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 20px 0;
  border-top: 1px solid #f0f0f0;
}
.cover {
  display: flex;
  width: 112px;
  height: 76px;
  flex: none;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 6px;
  background: #f0f5ff;
  color: #91a9dc;
  font-size: 28px;
}
.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.project-info {
  flex: 1;
  min-width: 0;
}
.title-line {
  flex-wrap: wrap;
  gap: 8px;
}
.title-line strong {
  overflow-wrap: anywhere;
  font-size: 15px;
}
.description {
  margin: 6px 0;
  color: #8c8c8c;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
.actions :deep(.ant-btn-link) {
  padding-inline: 4px;
}
.editor {
  margin-top: 20px;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.cover-preview {
  display: block;
  width: 200px;
  max-height: 120px;
  object-fit: cover;
  border-radius: 6px;
  margin-top: 10px;
}
.publish-field {
  margin-bottom: 0;
}
.publish-hint {
  margin-left: 12px;
}
@media (max-width: 900px) {
  .head {
    align-items: flex-start;
    flex-direction: column;
  }
  .project-row {
    flex-wrap: wrap;
  }
  .actions {
    width: 100%;
    flex-direction: row;
    justify-content: space-between;
  }
}
@media (max-width: 600px) {
  .form-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
