<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import UiAlert from '@/components/ui/UiAlert.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiLoading from '@/components/ui/UiLoading.vue'

import { api } from '@/api'
import { useDataRefresh } from '@/composables/useDataRefresh'
import TrendChart from '@/components/TrendChart.vue'
import UnusedImagesModal from '@/components/UnusedImagesModal.vue'
import type { DashboardStats, RecentItem, TodoItem } from '@/types'
import { sizeText } from '@/utils/bytes'

const router = useRouter()

const loading = ref(true)
const loadError = ref('')
const stats = ref<DashboardStats | null>(null)
const cleanupOpen = ref(false)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    stats.value = await api.dashboard()
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

onMounted(load)
useDataRefresh(load)

const counts = computed(() => stats.value?.counts ?? null)

const trendTotal = computed(() =>
  (stats.value?.trend ?? []).reduce((sum, point) => sum + point.count, 0),
)

function openItem(item: RecentItem | TodoItem) {
  void router.push({ name: 'affine', query: { file: item.file } })
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
  <div class="mb-6 flex flex-wrap justify-end gap-2">
    <UiButton variant="danger" icon="trash" @click="cleanupOpen = true">清理图片</UiButton>
  </div>
  <UiAlert v-if="loadError" class="mb-5" :message="loadError">
    <UiButton class="mt-3" :loading="loading" @click="load">重试</UiButton>
  </UiAlert>
  <UiLoading v-if="loading && !stats" />
  <div v-else-if="stats && counts" class="space-y-6" :aria-busy="loading">
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <section class="rounded-sm border border-panel-line bg-panel p-5">
        <h2 class="text-sm text-panel-muted">文章</h2>
        <p class="my-3 text-4xl font-bold tabular-nums">{{ counts.posts }}</p>
        <p class="text-xs text-panel-muted">
          已发布 {{ counts.published }} · 草稿 {{ counts.drafts }}
        </p>
      </section>
      <section class="rounded-sm border border-panel-line bg-panel p-5">
        <h2 class="text-sm text-panel-muted">固定页面</h2>
        <p class="my-3 text-4xl font-bold tabular-nums">{{ counts.pages }}</p>
        <p class="text-xs text-panel-muted">
          分类 {{ counts.categories }} · 标签 {{ counts.tags }}
        </p>
      </section>
      <section class="rounded-sm border border-panel-line bg-panel p-5">
        <h2 class="text-sm text-panel-muted">作品</h2>
        <p class="my-3 text-4xl font-bold tabular-nums">{{ counts.projects }}</p>
      </section>
      <section class="rounded-sm border border-panel-line bg-panel p-5">
        <h2 class="text-sm text-panel-muted">图片</h2>
        <p class="my-3 text-4xl font-bold tabular-nums">{{ counts.images }}</p>
        <p class="text-xs text-panel-muted">{{ sizeText(counts.imageBytes) }}</p>
      </section>
      <section class="rounded-sm border border-panel-line bg-panel p-5">
        <h2 class="text-sm text-panel-muted">未引用图片</h2>
        <p
          class="my-3 text-4xl font-bold tabular-nums"
          :class="counts.unusedImages ? 'text-danger' : ''"
        >
          {{ counts.unusedImages }}
        </p>
        <p v-if="counts.unusedImages" class="text-xs text-panel-muted">
          可释放 {{ sizeText(counts.unusedBytes) }} ·
          <button
            type="button"
            class="cursor-pointer text-interactive hover:underline"
            @click="cleanupOpen = true"
          >
            查看
          </button>
        </p>
      </section>
    </div>
    <section class="rounded-sm border border-panel-line bg-panel p-5">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-lg font-semibold">发文趋势</h2>
        <span class="text-xs text-panel-muted">近 12 个月共 {{ trendTotal }} 篇</span>
      </div>
      <TrendChart :points="stats.trend" />
    </section>
    <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <section class="min-w-0 rounded-sm border border-panel-line bg-panel p-5">
        <h2 class="mb-4 text-lg font-semibold">最近修改</h2>
        <ul v-if="stats.recent.length" class="divide-y divide-panel-line">
          <li
            v-for="item in stats.recent"
            :key="item.file"
            class="flex flex-wrap items-center gap-2 py-3"
          >
            <button
              type="button"
              class="min-w-0 flex-1 cursor-pointer break-words text-left text-base hover:text-interactive"
              @click="openItem(item)"
            >
              {{ item.title }}</button
            ><span
              v-if="item.draft"
              class="rounded-xs bg-accent/25 px-2 py-1 text-xs text-warning-ink"
              >草稿</span
            ><span
              v-if="item.kind === 'page'"
              class="rounded-xs bg-panel-raised px-2 py-1 text-xs text-panel-muted"
              >页面</span
            ><time class="w-full text-xs tabular-nums text-panel-muted sm:w-auto">{{
              formatTime(item.mtime)
            }}</time>
          </li>
        </ul>
        <p v-else class="py-10 text-center text-sm text-panel-muted">暂无内容</p>
      </section>
      <section class="min-w-0 rounded-sm border border-panel-line bg-panel p-5">
        <h2 class="mb-4 text-lg font-semibold">待办</h2>
        <div v-if="stats.todos.length" class="space-y-5">
          <div v-for="todo in stats.todos" :key="todo.key">
            <div class="mb-2 flex items-center gap-2 text-sm">
              <span>{{ todo.label }}</span
              ><span
                class="rounded-xs bg-accent/25 px-2 py-1 text-xs tabular-nums text-warning-ink"
                >{{ todo.count }}</span
              >
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button
                v-for="item in todo.items"
                :key="item.file"
                type="button"
                class="min-h-11 max-w-full cursor-pointer break-words rounded-sm border border-panel-line bg-panel-raised px-3 py-2 text-left text-sm text-panel-muted hover:border-interactive/40 hover:text-interactive"
                @click="openItem(item)"
              >
                {{ item.title }}</button
              ><span v-if="todo.count > todo.items.length" class="text-xs text-panel-muted"
                >其余 {{ todo.count - todo.items.length }} 条</span
              >
            </div>
          </div>
        </div>
        <p v-else class="py-10 text-center text-sm text-panel-muted">暂无待办</p>
      </section>
    </div>
  </div>
  <UnusedImagesModal v-model:open="cleanupOpen" @done="load" />
</template>
