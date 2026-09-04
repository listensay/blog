import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  modules: [
    '@nuxt/content',
  ],

  devtools: { enabled: true },
  compatibilityDate: '2025-05-15',

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    adminPassword: '',
    sessionSecret: '',
    visitorSalt: '',
  },

  nitro: {
    envPrefix: 'NUXT_',

    experimental: { database: true },

    database: {
      default: { connector: 'cloudflare-d1', options: { bindingName: 'DB' } },
    },
    devDatabase: {
      default: { connector: 'better-sqlite3', options: { path: '.data/app.sqlite3' } },
    },

    preset: 'cloudflare_module',
    cloudflare: {
      deployConfig: true,
      wrangler: {
        name: 'blog',
        routes: [
          {
            pattern: 'blog.200205.net',
            custom_domain: true,
          },
        ],
        d1_databases: [
          {
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
    pageTransition: { name: 'page', mode: 'out-in' },

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
      transformers: [
        '~~/transformers/slug-path.ts',
        '~~/transformers/image-src.ts',
        '~~/transformers/external-links.ts',
        '~~/transformers/taxonomy.ts',
      ],
      markdown: {
        toc: { depth: 3, searchDepth: 3 },
      },
    },
  },
})
