import { defineTransformer } from '@nuxt/content'

export default defineTransformer({
  name: 'slug-path-v2',
  extensions: ['.md'],
  transform(file) {
    const f = file as Record<string, unknown>

    if (!String(f.id).startsWith('blog/')) return file

    const slug = typeof f.slug === 'string' ? f.slug.trim() : ''
    if (!slug) return file

    const parts = String(f.id).split('/')
    parts.shift()
    parts.pop()
    return { ...file, path: '/' + [...parts, slug].join('/') }
  },
})
