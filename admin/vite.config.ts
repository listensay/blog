import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

import { blogAdminApi } from './server/blog-api.ts'

export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
    blogAdminApi(),
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    host: '127.0.0.1',
    port: 5173,
  },

  optimizeDeps: {
    include: ['ant-design-vue', '@ant-design/icons-vue', 'markdown-it', 'turndown'],
  },
})
