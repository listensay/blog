<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import UiFeedback from '@/components/ui/UiFeedback.vue'
import UiIcon from '@/components/ui/UiIcon.vue'
import UiButton from '@/components/ui/UiButton.vue'
import GitSyncStatus from '@/components/GitSyncStatus.vue'
import { chooseWorkspace } from '@/desktop'
import { notify } from '@/composables/useFeedback'
import { isTauri } from '@tauri-apps/api/core'
const route = useRoute()
const content = ref<HTMLElement>()
const switching = ref(false)
const sections = [
  { name: 'dashboard', label: '概览', icon: 'dashboard', path: '/' },
  { name: 'affine', label: '内容', icon: 'article', path: '/affine' },
  { name: 'comments', label: '评论', icon: 'comment', path: '/comments' },
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
async function openWorkspace() {
  if (switching.value) return
  switching.value = true
  try {
    await chooseWorkspace()
  } catch (error) {
    notify.error(error instanceof Error ? error.message : String(error))
  } finally {
    switching.value = false
  }
}
</script>
<template>
  <div class="h-dvh overflow-hidden">
    <div
      :inert="switching"
      class="flex h-full w-full flex-col overflow-hidden bg-panel md:flex-row"
    >
      <aside
        class="flex max-h-[40dvh] shrink-0 flex-col gap-6 overflow-y-auto overscroll-contain border-b border-panel-line p-4 md:max-h-none md:w-52 md:border-r md:border-b-0 md:p-5"
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
        <UiButton v-if="isTauri()" class="mt-auto" icon="folder" @click="openWorkspace"
          >打开博客</UiButton
        >
      </aside>
      <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <GitSyncStatus />
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
          <RouterView />
        </main>
      </div>
    </div>
    <UiFeedback />
  </div>
</template>
