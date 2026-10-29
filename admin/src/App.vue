<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { api } from '@/api'
import { useDataRefresh } from '@/composables/useDataRefresh'
import UiAlert from '@/components/ui/UiAlert.vue'
import UiFeedback from '@/components/ui/UiFeedback.vue'
import UiIcon from '@/components/ui/UiIcon.vue'
import type { WorkspaceInfo } from '@/types'
const route = useRoute()
const info = ref<WorkspaceInfo | null>(null)
const loadError = ref('')
const content = ref<HTMLElement>()
const sections = [
  { name: 'dashboard', label: '概览', icon: 'dashboard', path: '/' },
  { name: 'affine', label: 'Blog管理', icon: 'article', path: '/affine' },
  { name: 'links', label: '链接', icon: 'link', path: '/links' },
  { name: 'menu', label: '菜单', icon: 'menu', path: '/menu' },
  { name: 'settings-social', label: '社交设置', icon: 'social', path: '/settings/social' },
  { name: 'settings-system', label: '系统设置', icon: 'settings', path: '/settings/system' },
] as const
const active = computed(() =>
  sections.find((item) =>
    item.path === '/' ? route.path === '/' : route.path.startsWith(item.path),
  ),
)
watch(
  () => route.path,
  () => content.value?.scrollTo({ top: 0, left: 0, behavior: 'instant' }),
  { flush: 'post' },
)
async function load() {
  try {
    info.value = await api.workspace()
    loadError.value = ''
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : String(err)
  }
}
onMounted(load)
useDataRefresh(load)
</script>
<template>
  <div class="h-dvh overflow-hidden p-3 md:p-6">
    <div
      class="mx-auto flex h-full max-w-[1600px] flex-col overflow-hidden rounded-sm border border-panel-line bg-panel shadow-[0_12px_40px_rgb(34_35_51_/_5%)] md:flex-row"
    >
      <aside
        class="max-h-[40dvh] shrink-0 overflow-y-auto overscroll-contain border-b border-panel-line p-4 md:max-h-none md:w-52 md:border-r md:border-b-0 md:p-5"
      >
        <nav aria-label="管理导航" class="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-1">
          <RouterLink
            v-for="item in sections"
            :key="item.name"
            :to="{ name: item.name }"
            :aria-current="active?.name === item.name ? 'page' : undefined"
            class="flex min-h-11 items-center gap-2 rounded-sm border border-transparent px-3 py-2 text-sm transition-colors"
            :class="
              active?.name === item.name
                ? 'border-interactive/20 bg-interactive/10 text-interactive'
                : 'text-panel-muted hover:bg-panel-text/5 hover:text-panel-text'
            "
          >
            <UiIcon :name="item.icon" /><span>{{ item.label }}</span>
          </RouterLink>
        </nav>
      </aside>
      <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header
          v-if="active?.name !== 'affine'"
          class="flex min-h-20 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-panel-line px-5 py-4 md:px-8"
        >
          <h1 class="text-2xl font-bold tracking-tight">{{ active?.label }}</h1>
        </header>
        <main
          ref="content"
          class="min-h-0 flex-1 overscroll-contain"
          :class="
            active?.name === 'affine'
              ? 'flex flex-col overflow-hidden p-0'
              : 'overflow-y-auto bg-panel-raised/60 p-5 md:p-8'
          "
        >
          <UiAlert v-if="loadError" class="mb-5" message="无法读取博客" :description="loadError" />
          <RouterView />
        </main>
      </div>
    </div>
    <UiFeedback />
  </div>
</template>
