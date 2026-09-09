<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons-vue'

import { api } from '@/api'
import TrendChart from '@/components/TrendChart.vue'
import UnusedImagesModal from '@/components/UnusedImagesModal.vue'
import type { DashboardStats, RecentItem, TodoItem } from '@/types'
import { sizeText } from '@/utils/bytes'

const router = useRouter()

const loading = ref(false)
const stats = ref<DashboardStats | null>(null)
const cleanupOpen = ref(false)

async function load() {
  loading.value = true
  try {
    stats.value = await api.dashboard()
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  } finally {
    loading.value = false
  }
}

onMounted(load)

const counts = computed(() => stats.value?.counts ?? null)

const trendTotal = computed(() =>
  (stats.value?.trend ?? []).reduce((sum, point) => sum + point.count, 0),
)

function openItem(item: RecentItem | TodoItem) {
  const name = item.kind === 'post' ? 'post-edit' : 'page-edit'
  void router.push({ name, query: { file: item.file } })
}

function formatTime(value: number): string {
  const at = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ` +
    `${pad(at.getHours())}:${pad(at.getMinutes())}`
  )
}
</script>

<template>
  <div class="toolbar">
    <span class="spacer" />

    <a-button :loading="loading" @click="load">
      <template #icon><ReloadOutlined /></template>
      刷新
    </a-button>

    <a-button danger @click="cleanupOpen = true">
      <template #icon><DeleteOutlined /></template>
      清理垃圾
    </a-button>
  </div>

  <a-spin :spinning="loading && !stats">
    <div v-if="counts" class="cards">
      <a-card class="card" size="small">
        <a-statistic title="文章" :value="counts.posts" />
        <div class="sub">已发布 {{ counts.published }} · 草稿 {{ counts.drafts }}</div>
      </a-card>

      <a-card class="card" size="small">
        <a-statistic title="固定页面" :value="counts.pages" />
        <div class="sub">分类 {{ counts.categories }} · 标签 {{ counts.tags }}</div>
      </a-card>

      <a-card class="card" size="small">
        <a-statistic title="图片" :value="counts.images" />
        <div class="sub">public/images 合计 {{ sizeText(counts.imageBytes) }}</div>
      </a-card>

      <a-card class="card" size="small">
        <a-statistic
          title="未被引用的图片"
          :value="counts.unusedImages"
          :value-style="counts.unusedImages ? { color: '#cf1322' } : undefined"
        />
        <div class="sub">
          <template v-if="counts.unusedImages">
            可释放 {{ sizeText(counts.unusedBytes) }} ·
            <a @click="cleanupOpen = true">查看</a>
          </template>
          <template v-else>没有可清理的图片</template>
        </div>
      </a-card>
    </div>

    <a-card class="block" size="small" title="发文趋势">
      <template #extra>
        <span class="sub">近 12 个月共 {{ trendTotal }} 篇</span>
      </template>
      <TrendChart v-if="stats" :points="stats.trend" />
    </a-card>

    <div class="columns">
      <a-card class="block" size="small" title="最近修改">
        <a-list v-if="stats?.recent.length" :data-source="stats.recent" size="small" :split="false">
          <template #renderItem="{ item }">
            <a-list-item class="row">
              <div class="row-main">
                <a class="row-title" @click="openItem(item as RecentItem)">
                  {{ (item as RecentItem).title }}
                </a>
                <a-tag v-if="(item as RecentItem).draft" color="orange">草稿</a-tag>
                <a-tag v-if="(item as RecentItem).kind === 'page'">页面</a-tag>
              </div>
              <span class="mono sub">{{ formatTime((item as RecentItem).mtime) }}</span>
            </a-list-item>
          </template>
        </a-list>
        <a-empty v-else description="还没有内容" />
      </a-card>

      <a-card class="block" size="small" title="待办提示">
        <div v-if="stats?.todos.length" class="todos">
          <div v-for="todo in stats.todos" :key="todo.key" class="todo">
            <div class="todo-head">
              <span>{{ todo.label }}</span>
              <a-tag color="warning">{{ todo.count }}</a-tag>
            </div>
            <div class="todo-items">
              <a v-for="item in todo.items" :key="item.file" class="chip" @click="openItem(item)">
                {{ item.title }}
              </a>
              <span v-if="todo.count > todo.items.length" class="sub">
                还有 {{ todo.count - todo.items.length }} 条
              </span>
            </div>
          </div>
        </div>
        <a-empty v-else description="没有待办" />
      </a-card>
    </div>
  </a-spin>

  <UnusedImagesModal v-model:open="cleanupOpen" @done="load" />
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.spacer {
  flex: 1;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.card {
  border-radius: 8px;
}

.sub {
  color: #8c8c8c;
  font-size: 12px;
}

.block {
  margin-bottom: 16px;
  border-radius: 8px;
}

.columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 16px;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
}

.row-main {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.row-title {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.todos {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.todo-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 13px;
  color: #595959;
}

.todo-items {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.chip {
  max-width: 100%;
  padding: 2px 8px;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  background: #fafafa;
  font-size: 12px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.chip:hover {
  border-color: #1677ff;
  background: #f0f7ff;
}
</style>
