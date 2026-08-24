<script setup lang="ts">
/**
 * 文章列表：搜索、按分类/目录/草稿筛选、进编辑页、删除。
 *
 * 列表直接读磁盘，所以「刷新」是个显式按钮 —— 你在 Typora 里改完文章回来点一下就行，
 * 不做文件监听：Vite 的 watcher 只盯 admin 自己这个目录，跨到 ../content 去监听
 * 容易连带触发整页刷新，得不偿失。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue'

import { api } from '@/api'
import PostThumb from '@/components/PostThumb.vue'
import type { PostSummary } from '@/types'

const router = useRouter()

const loading = ref(false)
const posts = ref<PostSummary[]>([])
const categories = ref<string[]>([])
const dirs = ref<string[]>([])

const keyword = ref('')
const categoryFilter = ref<string[]>([])
const dirFilter = ref<string[]>([])
/** 'all' | 'draft' | 'published' */
const draftFilter = ref<'all' | 'draft' | 'published'>('all')

async function load() {
  loading.value = true
  try {
    const data = await api.listPosts()
    posts.value = data.posts
    categories.value = data.categories
    dirs.value = data.dirs
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  } finally {
    loading.value = false
  }
}

onMounted(load)

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()

  return posts.value.filter((post) => {
    if (categoryFilter.value.length && !categoryFilter.value.includes(post.category)) return false
    if (dirFilter.value.length && !dirFilter.value.includes(post.dir)) return false
    if (draftFilter.value === 'draft' && !post.draft) return false
    if (draftFilter.value === 'published' && post.draft) return false
    if (!kw) return true

    // 标题、描述、slug、文件名、标签都能搜到
    return [post.title, post.description, post.slug, post.name, post.tags.join(' ')]
      .join('\n')
      .toLowerCase()
      .includes(kw)
  })
})

/** frontmatter 里的 path 和 slug 算出来的真实 URL 不一致时提醒一下 */
function pathMismatch(post: PostSummary): boolean {
  return !!post.path && !!post.realPath && post.path !== post.realPath
}

const draftCount = computed(() => posts.value.filter((p) => p.draft).length)

function openEditor(post: PostSummary) {
  router.push({ name: 'post-edit', query: { file: post.file } })
}

async function remove(post: PostSummary) {
  try {
    const { trashed } = await api.deletePost(post.file)
    message.success(`已把《${post.title || post.name}》移到 admin/.trash/${trashed}`)
    await load()
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}

function formatDate(value: number): string {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

const columns = [
  // 88 = 72 的图 + 单元格左右内边距，固定住，缩略图列不要跟着内容伸缩
  { title: '封面', key: 'cover', width: 88 },
  { title: '标题', key: 'title' },
  { title: '分类', key: 'category', width: 110 },
  { title: '标签', key: 'tags', width: 180 },
  { title: '发布时间', key: 'date', width: 140 },
  { title: '文件', key: 'file' },
  { title: '', key: 'actions', width: 96, align: 'right' as const },
]
</script>

<template>
  <div class="toolbar">
    <a-input
      v-model:value="keyword"
      class="search"
      placeholder="搜标题、描述、slug、标签"
      allow-clear
    >
      <template #prefix><SearchOutlined /></template>
    </a-input>

    <a-select
      v-model:value="categoryFilter"
      class="filter"
      mode="multiple"
      placeholder="分类"
      :options="categories.map((c) => ({ value: c }))"
      :max-tag-count="1"
      allow-clear
    />

    <a-select
      v-model:value="dirFilter"
      class="filter"
      mode="multiple"
      placeholder="目录"
      :options="dirs.map((d) => ({ value: d }))"
      :max-tag-count="1"
      allow-clear
    />

    <a-radio-group v-model:value="draftFilter" button-style="solid">
      <a-radio-button value="all">全部</a-radio-button>
      <a-radio-button value="published">已发布</a-radio-button>
      <a-radio-button value="draft">草稿{{ draftCount ? ` ${draftCount}` : '' }}</a-radio-button>
    </a-radio-group>

    <span class="spacer" />

    <a-button :loading="loading" @click="load">
      <template #icon><ReloadOutlined /></template>
      刷新
    </a-button>

    <a-button type="primary" @click="router.push({ name: 'post-new' })">
      <template #icon><PlusOutlined /></template>
      写新文章
    </a-button>
  </div>

  <a-table
    class="post-table"
    :columns="columns"
    :data-source="filtered"
    :loading="loading"
    row-key="file"
    size="middle"
    :pagination="{ pageSize: 20, hideOnSinglePage: true, showTotal: (t: number) => `共 ${t} 篇` }"
  >
    <template #emptyText>
      <div class="empty">
        <p v-if="posts.length">没有符合条件的文章，换个筛选条件试试。</p>
        <p v-else>content/blog 下还没有文章。</p>
        <a-button type="primary" @click="router.push({ name: 'post-new' })">写新文章</a-button>
      </div>
    </template>

    <template #bodyCell="{ column, record }">
      <template v-if="column.key === 'cover'">
        <PostThumb :cover="(record as PostSummary).cover" :dir="(record as PostSummary).dir" />
      </template>

      <template v-else-if="column.key === 'title'">
        <a class="title-link" @click="openEditor(record as PostSummary)">
          {{ (record as PostSummary).title || '（没有标题）' }}
        </a>
        <a-tag v-if="(record as PostSummary).draft" color="orange" class="draft-tag">草稿</a-tag>
        <div class="sub">
          <span class="mono">{{ (record as PostSummary).realPath }}</span>
          <a-tooltip
            v-if="pathMismatch(record as PostSummary)"
            :title="`frontmatter 里写的是 ${(record as PostSummary).path}，但真实 URL 由 slug 决定，是上面这个`"
          >
            <a-tag color="warning" class="mismatch">path 不一致</a-tag>
          </a-tooltip>
        </div>
      </template>

      <template v-else-if="column.key === 'category'">
        <a-tag v-if="(record as PostSummary).category">{{ (record as PostSummary).category }}</a-tag>
        <span v-else class="muted">—</span>
      </template>

      <template v-else-if="column.key === 'tags'">
        <span v-if="!(record as PostSummary).tags.length" class="muted">—</span>
        <a-tag v-for="tag in (record as PostSummary).tags" :key="tag" color="blue">{{ tag }}</a-tag>
      </template>

      <template v-else-if="column.key === 'date'">
        <!-- 日期和时刻分两行：等宽字体下时间对齐，扫一眼就能比较 -->
        <div class="mono">{{ (record as PostSummary).date.slice(0, 10) || '—' }}</div>
        <div class="mono sub">{{ (record as PostSummary).date.slice(11) || '' }}</div>
      </template>

      <template v-else-if="column.key === 'file'">
        <div class="mono file">{{ (record as PostSummary).file }}</div>
        <div class="sub muted">
          {{ Math.round((record as PostSummary).bytes / 1024) }} KB ·
          {{ (record as PostSummary).images }} 图 · 改于
          {{ formatDate((record as PostSummary).mtime) }}
        </div>
      </template>

      <template v-else-if="column.key === 'actions'">
        <a-space :size="4">
          <a-tooltip title="编辑">
            <a-button type="text" size="small" @click="openEditor(record as PostSummary)">
              <template #icon><EditOutlined /></template>
            </a-button>
          </a-tooltip>

          <a-popconfirm
            :title="`把《${(record as PostSummary).title || (record as PostSummary).name}》移到 admin/.trash/？`"
            ok-text="移到回收站"
            cancel-text="算了"
            @confirm="remove(record as PostSummary)"
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

.search {
  width: 260px;
}

.filter {
  min-width: 140px;
}

.spacer {
  flex: 1;
}

.post-table {
  background: #fff;
  border-radius: 8px;
}

.title-link {
  font-weight: 500;
}

.draft-tag {
  margin-left: 6px;
}

.sub {
  margin-top: 2px;
  font-size: 12px;
  color: #8c8c8c;
}

.mismatch {
  margin-left: 6px;
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
