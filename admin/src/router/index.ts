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
      path: '/edit',
      name: 'post-edit',
      component: () => import('@/views/PostEditorView.vue'),
    },

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
      path: '/pages/edit',
      name: 'page-edit',
      component: () => import('@/views/PageEditorView.vue'),
    },

    {
      path: '/menu',
      name: 'menu',
      component: () => import('@/views/NavView.vue'),
    },

    {
      path: '/links',
      name: 'links',
      component: () => import('@/views/LinkView.vue'),
    },
  ],
})

export default router
