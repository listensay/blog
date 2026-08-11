import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/content',
  ],

  devtools: { enabled: true },
  compatibilityDate: '2024-04-03',

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },

  content: {
    build: {
      // 让 frontmatter 的 slug 决定文章 URL（中文文件名必需）
      transformers: ['~~/transformers/slug-path.ts'],
      markdown: {
        toc: { depth: 3, searchDepth: 3 },
      },
    },
  },
})
