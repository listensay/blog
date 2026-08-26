<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue'

import { api } from '@/api'
import type { PageSummary } from '@/types'

const router = useRouter()

const loading = ref(false)
const pages = ref<PageSummary[]>([])

async function load() {
  loading.value = true
  try {
    pages.value = (await api.listPages()).pages
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  } finally {
    loading.value = false
  }
}

onMounted(load)

function openEditor(page: PageSummary) {
  router.push({ name: 'page-edit', query: { file: page.file } })
}

async function remove(page: PageSummary) {
  try {
    const { trashed } = await api.deletePage(page.file)
    message.success(`已把《${page.title || page.name}》移到 admin/.trash/${trashed}`)
    await load()
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}

function formatDate(value: number): string {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function formatSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`
}

const friendCount = (page: PageSummary) => page.friends.length

function removeHint(page: PageSummary): string {
  const gone = page.customRoute
    ? `${page.path} 的排版是站点上手写的，删了不会 404，会变成一个空页面（不报错）`
    : `${page.path} 会 404`
  return `把《${page.title || page.name}》移到 admin/.trash/？${gone}`
}

const columns = [
  { title: '标题', key: 'title' },
  { title: '网址', key: 'path', width: 220 },
  { title: '文件', key: 'file', width: 300 },
  { title: '', key: 'actions', width: 96, align: 'right' as const },
]

const total = computed(() => pages.value.length)
</script>

<template>
  <div class="toolbar">
    <span class="spacer" />

    <a-button :loading="loading" @click="load">
      <template #icon><ReloadOutlined /></template>
      刷新
    </a-button>

    <a-button type="primary" @click="router.push({ name: 'page-new' })">
      <template #icon><PlusOutlined /></template>
      新建页面
    </a-button>
  </div>

  <a-table
    class="page-table"
    :columns="columns"
    :data-source="pages"
    :loading="loading"
    row-key="file"
    size="middle"
    :pagination="{ pageSize: 20, hideOnSinglePage: true, showTotal: () => `共 ${total} 个页面` }"
  >
    <template #emptyText>
      <div class="empty">
        <p>content/pages 下还没有页面。</p>
        <a-button type="primary" @click="router.push({ name: 'page-new' })">新建页面</a-button>
      </div>
    </template>

    <template #bodyCell="{ column, record }">
      <template v-if="column.key === 'title'">
        <a class="title-link" @click="openEditor(record as PageSummary)">
          {{ (record as PageSummary).title || '（没有标题）' }}
        </a>
        <a-tag v-if="friendCount(record as PageSummary)" color="blue" class="friend-tag">
          {{ friendCount(record as PageSummary) }} 条友链
        </a-tag>
        <div v-if="(record as PageSummary).description" class="sub">
          {{ (record as PageSummary).description }}
        </div>
      </template>

      <template v-else-if="column.key === 'path'">
        <div class="mono">{{ (record as PageSummary).path }}</div>
      </template>

      <template v-else-if="column.key === 'file'">
        <div class="mono file">content/{{ (record as PageSummary).file }}</div>
        <div class="sub muted">
          {{ formatSize((record as PageSummary).bytes) }} · {{ (record as PageSummary).images }} 图
          · 改于
          {{ formatDate((record as PageSummary).mtime) }}
        </div>
      </template>

      <template v-else-if="column.key === 'actions'">
        <a-space :size="4">
          <a-tooltip title="编辑">
            <a-button type="text" size="small" @click="openEditor(record as PageSummary)">
              <template #icon><EditOutlined /></template>
            </a-button>
          </a-tooltip>

          <a-popconfirm
            :title="removeHint(record as PageSummary)"
            ok-text="移到回收站"
            cancel-text="算了"
            @confirm="remove(record as PageSummary)"
          >
            <a-tooltip title="删除">
              <a-button type="text" size="small" danger>
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </a-tooltip>
          </a-popconfirm>
        </a-space>
      </template>
    </template>
  </a-table>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.hint {
  max-width: 640px;
  color: #8c8c8c;
  font-size: 12px;
  line-height: 1.7;
}

.spacer {
  flex: 1;
}

.page-table {
  background: #fff;
  border-radius: 8px;
}

.title-link {
  font-weight: 500;
}

.friend-tag {
  margin-left: 6px;
}

.sub {
  margin-top: 2px;
  font-size: 12px;
  color: #8c8c8c;
}

.file {
  color: #595959;
}

.muted {
  color: #bfbfbf;
}

.empty {
  padding: 32px 0;
}

.empty p {
  margin-bottom: 12px;
  color: #8c8c8c;
}
</style>
