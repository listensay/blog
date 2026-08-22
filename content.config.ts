import { defineContentConfig, defineCollection, z } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    // 博客文章：content/blog/*.md，路由前缀 /blog
    blog: defineCollection({
      type: 'page',
      source: {
        include: 'blog/**/*.md',
        prefix: '/blog',
      },
      schema: z.object({
        title: z.string(),
        description: z.string(),
        /**
         * 发布时间，写成 `YYYY-MM-DD HH:mm`（作者本地时间，不带秒）。
         *
         * 为什么是 `z.string()` 而不是 `z.date()`：@nuxt/content 把 zod schema 转成
         * JSON Schema 时**硬编码**了 `dateStrategy: 'format:date'`，于是 `z.date()`
         * 永远映射成 SQL 的 `DATE` 列，入库时被截成 `YYYY-MM-DD` —— 时刻会被丢掉，
         * 同一天的文章也就没法按时间排序。用 `z.string()` 得到 `VARCHAR` 列，
         * frontmatter 里的字符串原样入库，`.order('date','DESC')` 按字典序排正好等于
         * 按时间排（格式定长）。
         *
         * 不带秒也是刻意的：这个写法在 YAML 1.1 和 1.2 里都是纯字符串，
         * 没有哪一层解析会把它变成 Date，也就没有时区能把日期挪走。
         * 显示与格式化统一走 app/utils/date.ts，那里不经过 Date。
         */
        date: z.string(),
        // URL 片段：文件名用中文，网址用这个（见 transformers/slug-path.ts）
        slug: z.string(),
        // 允许 slug-path transformer 覆盖子目录带来的默认 path
        path: z.string().optional(),
        // 一篇文章归一个分类
        category: z.string().default('未分类'),
        tags: z.array(z.string()).default([]),
        // 草稿不出现在列表页
        draft: z.boolean().default(false),
        cover: z.string().optional(),
      }),
    }),

    // 独立页面：content/pages/*.md，如「关于」
    pages: defineCollection({
      type: 'page',
      source: {
        include: 'pages/**/*.md',
        prefix: '/',
      },
      schema: z.object({
        title: z.string(),
        description: z.string().default(''),
      }),
    }),
  },
})
