import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'posts',
      component: () => import('@/views/PostListView.vue'),
    },
    {
      path: '/new',
      name: 'post-new',
      component: () => import('@/views/PostEditorView.vue'),
    },
    {
      // 文件路径带斜杠和中文，放 query 里比塞进 path 省事（`?file=blog/ai/xxx.md`）
      path: '/edit',
      name: 'post-edit',
      component: () => import('@/views/PostEditorView.vue'),
    },
  ],
})

export default router
