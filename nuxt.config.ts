import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/content',
  ],

  devtools: { enabled: true },
  // 部署到 Cloudflare Workers 要求 >= 2024-09-19
  compatibilityDate: '2025-05-15',

  css: ['~/assets/css/main.css'],

  nitro: {
    preset: 'cloudflare_module',
    cloudflare: {
      // 构建时自动生成 .output/server/wrangler.json，不用手写 wrangler 配置
      deployConfig: true,
      wrangler: {
        d1_databases: [
          {
            // binding 必须是 DB，@nuxt/content 认这个名字
            binding: 'DB',
            database_name: 'blog-content',
            database_id: '4ab64588-9f9f-4878-b41b-770158f76a83',
          },
        ],
      },
    },
  },

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
