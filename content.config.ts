import { defineContentConfig, defineCollection, z } from '@nuxt/content'

const blogSchema = z.object({
  title: z.string(),
  description: z.string(),
  date: z.string(),
  slug: z.string(),
  path: z.string(),
  category: z.string().default('未分类'),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  cover: z.string().optional(),
})

const pageSchema = z.object({
  title: z.string(),
  description: z.string().default(''),
  comments: z.boolean().default(false),
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
})

export default defineContentConfig({
  collections: {
    blog: defineCollection({
      type: 'page',
      source: { include: 'blog/**/*.md', prefix: '/blog' },
      schema: blogSchema,
    }),
    blogEn: defineCollection({
      type: 'page',
      source: { include: 'en/blog/**/*.md', prefix: '/en/blog' },
      schema: blogSchema,
    }),
    pages: defineCollection({
      type: 'page',
      source: { include: 'pages/**/*.md', prefix: '/' },
      schema: pageSchema,
    }),
    pagesEn: defineCollection({
      type: 'page',
      source: { include: 'en/pages/**/*.md', prefix: '/en' },
      schema: pageSchema,
    }),
  },
})
