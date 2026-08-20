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
        // frontmatter 写 YYYY-MM-DD，构建时转为 date 字段便于排序
        date: z.date(),
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
