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
        <!-- 内包裹和下面的 .content 用同一组宽度，顶栏两端才和正文对齐（见 --shell-max / --shell-pad） -->
        <div class="topbar-inner">
          <RouterLink to="/" class="brand">blog 文章管理</RouterLink>

          <div class="topbar-meta">
            <template v-if="info">
              <span class="mono blog-root" :title="info.blogRoot">{{ info.blogRoot }}</span>
              <a-divider type="vertical" />
              <span class="counts">{{ info.postCount }} 篇文章 · {{ info.imageCount }} 张图片</span>
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

  /*
   * 顶栏和正文共用这一组宽度。分成两个变量、而不是各写一遍 24px + 1440px，
   * 是因为「顶栏两端要和正文对齐」这件事只有同时改两处才成立 ——
   * 写成变量之后改一个地方就不会漏。
   */
  --shell-max: 1440px;
  --shell-pad: 24px;
}

.topbar {
  height: 56px;
  /* 内边距交给 .topbar-inner，这里清零，否则会和它叠加 */
  padding: 0;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  line-height: normal;
}

/* 和 .content 完全同一组约束：等宽、居中、同样的左右内边距 */
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
  max-width: var(--shell-max);
  width: 100%;
  margin: 0 auto;
  padding: var(--shell-pad);
}

.boot-error {
  margin-bottom: 16px;
}
</style>
