import { defineTransformer } from '@nuxt/content'

/**
 * 让 frontmatter 的 slug 决定文章 URL。
 *
 * 背景：Nuxt Content 默认用文件名生成 path，中间会过一遍 slugify，
 * 而 slugify 会把中文清空 —— "我的第一篇文章" -> ""、"嵌入式开发笔记" -> ""，
 * 于是多篇中文命名的文章会撞成同一个 path，互相覆盖。
 *
 * 因此文件名保持中文（便于自己管理），URL 由 frontmatter 的 slug 显式指定。
 *
 * 实现细节：用户 transformer 先于内置 path-meta 执行，而 path-meta 返回的是
 * `{ path: filePath, ...content }` —— content 展开在后，这里设的 path 会保留下来。
 */
export default defineTransformer({
  name: 'slug-path',
  extensions: ['.md'],
  transform(file) {
    const f = file as Record<string, unknown>
    const slug = typeof f.slug === 'string' ? f.slug.trim() : ''
    if (!slug) return file

    // id 形如 "blog/blog/我的第一篇文章.md"：
    // 首段是集合名，需丢弃；余下是相对 source 的目录 + 文件名
    const parts = String(f.id).split('/')
    parts.shift() // 去掉集合名
    parts.pop() // 去掉文件名（由 slug 取代）
    const dir = parts.join('/')

    return { ...file, path: '/' + [dir, slug].filter(Boolean).join('/') }
  },
})
