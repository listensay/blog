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

    // 固定页（content/pages/**.md）
    {
      path: '/pages',
      name: 'pages',
      component: () => import('@/views/PageListView.vue'),
    },
    {
      path: '/pages/new',
      name: 'page-new',
      component: () => import('@/views/PageEditorView.vue'),
    },
    {
      // 同上，`?file=pages/about.md`
      path: '/pages/edit',
      name: 'page-edit',
      component: () => import('@/views/PageEditorView.vue'),
    },

    // 顶部菜单（content/data/nav.json）
    {
      path: '/menu',
      name: 'menu',
      component: () => import('@/views/NavView.vue'),
    },
  ],
})

export default router
