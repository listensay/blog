<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import {
  FileTextOutlined,
  LinkOutlined,
  MenuOutlined,
  ProfileOutlined,
  SettingOutlined,
  ShareAltOutlined,
} from '@ant-design/icons-vue'

import { api } from '@/api'
import type { WorkspaceInfo } from '@/types'

const route = useRoute()

const info = ref<WorkspaceInfo | null>(null)
const loadError = ref('')

const sections = [
  {
    name: 'posts',
    label: '文章',
    icon: FileTextOutlined,
    match: (path: string) => path === '/' || path.startsWith('/new') || path.startsWith('/edit'),
  },
  {
    name: 'pages',
    label: '页面',
    icon: ProfileOutlined,
    match: (path: string) => path.startsWith('/pages'),
  },
  {
    name: 'links',
    label: '链接',
    icon: LinkOutlined,
    match: (path: string) => path.startsWith('/links'),
  },
  {
    name: 'menu',
    label: '菜单',
    icon: MenuOutlined,
    match: (path: string) => path.startsWith('/menu'),
  },
  {
    name: 'settings-social',
    label: '社交设置',
    icon: ShareAltOutlined,
    match: (path: string) => path.startsWith('/settings/social'),
  },
  {
    name: 'settings-system',
    label: '系统设置',
    icon: SettingOutlined,
    match: (path: string) => path.startsWith('/settings/system'),
  },
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
    <a-layout class="shell" has-sider>
      <a-layout-sider class="sider" theme="light" :width="200">
        <RouterLink to="/" class="brand">blog 管理</RouterLink>

        <nav class="sections">
          <RouterLink
            v-for="item in sections"
            :key="item.name"
            :to="{ name: item.name }"
            class="section"
            :class="{ 'section-active': activeSection === item.name }"
          >
            <component :is="item.icon" class="section-icon" />
            <span>{{ item.label }}</span>
          </RouterLink>
        </nav>
      </a-layout-sider>

      <a-layout class="main">
        <a-layout-header class="topbar">
          <div class="topbar-meta">
            <template v-if="info">
              <span class="mono blog-root" :title="info.blogRoot">{{ info.blogRoot }}</span>
              <a-divider type="vertical" />
              <span class="counts">
                {{ info.postCount }} 篇文章 · {{ info.pageCount }} 个页面 ·
                {{ info.imageCount }} 张图片
              </span>
            </template>
            <a-tag v-else-if="loadError" color="error">本地接口连接失败</a-tag>
          </div>
        </a-layout-header>

        <a-layout-content class="content">
          <a-alert
            v-if="loadError"
            class="boot-error"
            type="error"
            show-icon
            message="无法读取 blog 仓库"
          >
            <template #description>
              {{ loadError }}
              <br />
              admin 需要位于 blog 仓库内（<code>blog/admin</code>）才能定位
              <code>../content/blog</code>。目录不在此处时，用环境变量
              <code>ADMIN_BLOG_ROOT</code> 指定 blog 根目录后重启 dev server。
            </template>
          </a-alert>

          <RouterView />
        </a-layout-content>
      </a-layout>
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

/* 侧边栏钉在左侧，长页面滚动时菜单不跟着走。 */
.sider {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 10;
  overflow: auto;
  border-right: 1px solid #f0f0f0;
}

.main {
  /* 让开固定定位的侧边栏。 */
  margin-left: 200px;
  background: transparent;
}

.brand {
  display: block;
  padding: 0 16px;
  height: 56px;
  line-height: 56px;
  color: #1f1f1f;
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
}

.brand:hover {
  color: #1677ff;
}

.sections {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
}

.section {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
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

.section-icon {
  font-size: 16px;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 56px;
  padding: 0 var(--shell-pad);
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  line-height: normal;
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
