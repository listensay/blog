import { defineTransformer } from '@nuxt/content'

// Nuxt Content exposes its query database to browsers. Keep draft text and
// metadata in the source file only, including after a public entry is withdrawn.
export default defineTransformer({
  name: 'journal-privacy',
  extensions: ['.md'],
  transform(file) {
    const entry = file as Record<string, unknown>
    if (!/^journals\//.test(String(entry.id))) return file
    if (entry.draft !== true) {
      const { description, tags, cover, ...journal } = entry
      // Page collections otherwise retain an automatically generated excerpt.
      return { ...journal, description: '' }
    }
    return {
      id: file.id,
      date: entry.date,
      draft: true,
      title: '',
      description: '',
      body: { type: 'minimark', value: [], toc: { links: [] } },
    }
  },
})
