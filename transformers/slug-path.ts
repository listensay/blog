import { defineTransformer } from '@nuxt/content'

// 让 frontmatter 的 slug 决定文章 URL：内置 slugify 会把中文文件名清空，多篇文章
// 会撞成同一个 path 互相覆盖。本 transformer 先于 path-meta 执行，这里设的 path 会保留
export default defineTransformer({
  name: 'slug-path-v2',
  extensions: ['.md'],
  transform(file) {
    const f = file as Record<string, unknown>

    // 只管 blog 集合：固定页的网址就是文件名，让 slug 改写它的 path 会导致原网址静默 404
    if (!String(f.id).startsWith('blog/')) return file

    const slug = typeof f.slug === 'string' ? f.slug.trim() : ''
    if (!slug) return file

    // id 形如 "blog/blog/ai/文章.md"：丢掉集合名和文件名，
    // 保留中间的英文分类目录，生成 /blog/ai/article-slug。
    const parts = String(f.id).split('/')
    parts.shift()
    parts.pop()
    return { ...file, path: '/' + [...parts, slug].join('/') }
  },
})
