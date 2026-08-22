import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

import { blogAdminApi } from './server/blog-api.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
    // 读写 ../content/blog/**.md 和 ../public/images/ 的本地接口，只在 dev/preview 存在
    blogAdminApi(),
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    // 这个后台没有鉴权，只监听回环地址，别暴露到局域网
    host: '127.0.0.1',
    port: 5173,
  },

  // ant-design-vue 体积不小，预构建时一次性处理掉，省得首屏一路瀑布式请求
  optimizeDeps: {
    include: ['ant-design-vue', '@ant-design/icons-vue', 'markdown-it', 'turndown'],
  },
})
