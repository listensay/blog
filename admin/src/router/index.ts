import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/projects',
      name: 'projects',
      component: () => import('@/views/ProjectsView.vue'),
    },
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
    },

    {
      path: '/affine',
      name: 'affine',
      component: () => import('@/views/AffineView.vue'),
    },
    ...['/posts', '/new', '/edit', '/pages', '/pages/new', '/pages/edit'].map((path) => ({
      path,
      redirect: '/affine',
    })),

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

    {
      path: '/settings/social',
      name: 'settings-social',
      component: () => import('@/views/SocialSettingsView.vue'),
    },
    {
      path: '/settings/system',
      name: 'settings-system',
      component: () => import('@/views/SystemSettingsView.vue'),
    },
  ],
})

export default router
