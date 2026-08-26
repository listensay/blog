<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue'

import { api } from '@/api'
import type { PageSummary } from '@/types'

const router = useRouter()

const LINKS_FILE = 'pages/links.md'

const loading = ref(false)
const pages = ref<PageSummary[]>([])

async function load() {
  loading.value = true
  try {
    const list = await api.listPages()
    pages.value = list.pages.filter((page) => page.file !== LINKS_FILE)
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
    await api.deletePage(page.file)
    message.success(`已将《${page.title || page.name}》移到回收站`)
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

function removeHint(page: PageSummary): string {
  return `将《${page.title || page.name}》移到回收站？${page.path} 将返回 404。`
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
          {{ (record as PageSummary).title || '未命名' }}
        </a>
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
            cancel-text="取消"
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
