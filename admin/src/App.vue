<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import zhCN from 'ant-design-vue/es/locale/zh_CN'

import { api } from '@/api'
import type { WorkspaceInfo } from '@/types'

const route = useRoute()

const info = ref<WorkspaceInfo | null>(null)
const loadError = ref('')

const sections = [
  {
    name: 'posts',
    label: '文章',
    match: (path: string) => path === '/' || path.startsWith('/new') || path.startsWith('/edit'),
  },
  { name: 'pages', label: '页面', match: (path: string) => path.startsWith('/pages') },
  { name: 'menu', label: '菜单', match: (path: string) => path.startsWith('/menu') },
] as const

const activeSection = computed(() => sections.find((item) => item.match(route.path))?.name ?? '')

onMounted(async () => {
  try {
    info.value = await api.workspace()
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : String(err)
  }
})
</script>

<template>
  <a-config-provider :locale="zhCN">
    <a-layout class="shell">
      <a-layout-header class="topbar">
        <div class="topbar-inner">
          <div class="topbar-left">
            <RouterLink to="/" class="brand">blog 管理</RouterLink>

            <nav class="sections">
              <RouterLink
                v-for="item in sections"
                :key="item.name"
                :to="{ name: item.name }"
                class="section"
                :class="{ 'section-active': activeSection === item.name }"
              >
                {{ item.label }}
              </RouterLink>
            </nav>
          </div>

          <div class="topbar-meta">
            <template v-if="info">
              <span class="mono blog-root" :title="info.blogRoot">{{ info.blogRoot }}</span>
              <a-divider type="vertical" />
              <span class="counts">
                {{ info.postCount }} 篇文章 · {{ info.pageCount }} 个页面 ·
                {{ info.imageCount }} 张图片
              </span>
            </template>
            <a-tag v-else-if="loadError" color="error">连不上本地接口</a-tag>
          </div>
        </div>
      </a-layout-header>

      <a-layout-content class="content">
        <a-alert
          v-if="loadError"
          class="boot-error"
          type="error"
          show-icon
          message="读不到 blog 仓库"
        >
          <template #description>
            {{ loadError }}
            <br />
            admin 需要放在 blog 仓库里面（`blog/admin`）才能找到
            <code>../content/blog</code>。目录不在这儿的话，用环境变量
            <code>ADMIN_BLOG_ROOT</code> 指定 blog 根目录后重启 dev server。
          </template>
        </a-alert>

        <RouterView />
      </a-layout-content>
    </a-layout>
  </a-config-provider>
</template>

<style scoped>
.shell {
  min-height: 100%;
  background: #f5f5f5;

  --shell-max: 1440px;
  --shell-pad: 24px;
}

.topbar {
  height: 56px;
  padding: 0;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  line-height: normal;
}

.topbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 100%;
  max-width: var(--shell-max);
  width: 100%;
  margin: 0 auto;
  padding: 0 var(--shell-pad);
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 20px;
  min-width: 0;
}

.brand {
  font-size: 15px;
  font-weight: 600;
  color: #1f1f1f;
  white-space: nowrap;
}

.brand:hover {
  color: #1677ff;
}

.sections {
  display: flex;
  align-items: center;
  gap: 4px;
}

.section {
  padding: 4px 10px;
  border-radius: 6px;
  color: #595959;
  font-size: 14px;
  white-space: nowrap;
}

.section:hover {
  background: #f5f5f5;
  color: #1f1f1f;
}

.section-active,
.section-active:hover {
  background: #e6f4ff;
  color: #1677ff;
  font-weight: 500;
}

.topbar-meta {
  display: flex;
  align-items: center;
  min-width: 0;
  color: #8c8c8c;
  font-size: 12px;
}

.blog-root {
  max-width: 30vw;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.counts {
  white-space: nowrap;
}

.content {
  max-width: var(--shell-max);
  width: 100%;
  margin: 0 auto;
  padding: var(--shell-pad);
}

.boot-error {
  margin-bottom: 16px;
}
</style>
