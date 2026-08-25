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
        // 发布时间写成 `YYYY-MM-DD HH:mm`，别补秒：带秒会被 YAML 1.1 当时间戳，时区能把日期挪走
        // 不用 z.date()：它必然映射成 SQL 的 DATE 列，入库截成 YYYY-MM-DD，同一天的文章没法排序
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

    // 独立页面：content/pages/*.md，如「关于」「友情链接」
    // 路由由 app/pages/[...page].vue 兜住，所以新加一个 md 文件就有一个页面，不用改代码
    pages: defineCollection({
      type: 'page',
      source: {
        include: 'pages/**/*.md',
        prefix: '/',
      },
      schema: z.object({
        title: z.string(),
        description: z.string().default(''),
        /** 友情链接，只有 app/pages/links.vue 渲染它（后台的友链编辑器也只在 pages/links.md 出现） */
        friends: z
          .array(
            z.object({
              name: z.string(),
              /** 站点地址：http(s) 外链，或者 `/` 开头的本站路径 */
              url: z.string(),
              description: z.string().default(''),
              /** 头像：`/images/x.png` 或 http(s) URL。这个字段不走 image-src 改写，别写相对路径 */
              avatar: z.string().optional(),
            }),
          )
          .default([]),
      }),
    }),
  },
})
