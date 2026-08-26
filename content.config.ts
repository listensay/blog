import { defineContentConfig, defineCollection, z } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    blog: defineCollection({
      type: 'page',
      source: {
        include: 'blog/**/*.md',
        prefix: '/blog',
      },
      schema: z.object({
        title: z.string(),
        description: z.string(),
        date: z.string(),
        slug: z.string(),
        path: z.string().optional(),
        category: z.string().default('未分类'),
        tags: z.array(z.string()).default([]),
        draft: z.boolean().default(false),
        cover: z.string().optional(),
      }),
    }),

    pages: defineCollection({
      type: 'page',
      source: {
        include: 'pages/**/*.md',
        prefix: '/',
      },
      schema: z.object({
        title: z.string(),
        description: z.string().default(''),
        friends: z
          .array(
            z.object({
              name: z.string(),
              url: z.string(),
              description: z.string().default(''),
              avatar: z.string().optional(),
            }),
          )
          .default([]),
      }),
    }),
  },
})
