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

  // 服务端密钥，全部由环境变量注入（NUXT_ 前缀自动映射）
  // 线上用 wrangler secret put NUXT_ADMIN_PASSWORD 等命令设置
  runtimeConfig: {
    adminPassword: '',
    sessionSecret: '',
    visitorSalt: '',
  },

  nitro: {
    // Nitro 生产运行时默认只读取 NITRO_*。项目的线上密钥沿用 Nuxt 惯例命名为
    // NUXT_*，因此把它设为备用前缀；NITRO_* 仍然继续受支持。
    envPrefix: 'NUXT_',

    // nitropack 2.13 仍把数据库层放在 experimental 后面：不开这个开关，
    // useDatabase() 既不会被自动导入，连接器也不会打进产物（实测报 useDatabase is not defined）
    experimental: { database: true },

    // 线上走 D1（复用 @nuxt/content 的 DB binding），本地 dev 走文件 SQLite。
    // 两边都是 SQLite 方言，业务代码只写一份。
    database: {
      default: { connector: 'cloudflare-d1', options: { bindingName: 'DB' } },
    },
    devDatabase: {
      default: { connector: 'better-sqlite3', options: { path: '.data/app.sqlite3' } },
    },

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
