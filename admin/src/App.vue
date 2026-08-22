<script setup lang="ts">
/**
 * 外壳：顶栏 + 路由出口。
 *
 * 顶栏一直显示正在编辑哪个 blog 仓库 —— 这个后台直接改磁盘上的文件，
 * 「我在改哪个目录」是随时都该看得见的信息。
 */
import { onMounted, ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import zhCN from 'ant-design-vue/es/locale/zh_CN'

import { api } from '@/api'
import type { WorkspaceInfo } from '@/types'

const info = ref<WorkspaceInfo | null>(null)
const loadError = ref('')

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
        <RouterLink to="/" class="brand">blog 文章管理</RouterLink>

        <div class="topbar-meta">
          <template v-if="info">
            <span class="mono blog-root" :title="info.blogRoot">{{ info.blogRoot }}</span>
            <a-divider type="vertical" />
            <span class="counts">{{ info.postCount }} 篇文章 · {{ info.imageCount }} 张图片</span>
          </template>
          <a-tag v-else-if="loadError" color="error">连不上本地接口</a-tag>
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
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 56px;
  padding: 0 24px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  line-height: normal;
}

.brand {
  font-size: 15px;
  font-weight: 600;
  color: #1f1f1f;
}

.brand:hover {
  color: #1677ff;
}

.topbar-meta {
  display: flex;
  align-items: center;
  min-width: 0;
  color: #8c8c8c;
  font-size: 12px;
}

/* 路径可能很长；直接尾部省略，鼠标悬停有完整路径 */
.blog-root {
  max-width: 40vw;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.counts {
  white-space: nowrap;
}

.content {
  max-width: 1440px;
  width: 100%;
  margin: 0 auto;
  padding: 24px;
}

.boot-error {
  margin-bottom: 16px;
}
</style>
