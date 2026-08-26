import { defineTransformer } from '@nuxt/content'


const TAG_SEPARATORS = /[,，、]/

function toStringList(input: unknown): string[] {
  const raw = typeof input === 'string'
    ? input.split(TAG_SEPARATORS)
    : Array.isArray(input)
      ? input.flatMap(v => (typeof v === 'string' ? v.split(TAG_SEPARATORS) : []))
      : []

  const seen = new Set<string>()
  for (const item of raw) {
    const value = item.trim()
    if (value) seen.add(value)
  }
  return [...seen]
}

export default defineTransformer({
  name: 'taxonomy',
  extensions: ['.md'],
  transform(file) {
    const f = file as Record<string, unknown>
    const patch: Record<string, unknown> = {}

    if ('tags' in f) {
      patch.tags = toStringList(f.tags)
    }

    if (typeof f.category === 'string' && TAG_SEPARATORS.test(f.category)) {
      const [first, ...rest] = toStringList(f.category)
      console.warn(
        `[taxonomy] ${f.id}: category 只能有一个，"${f.category}" 已按 "${first}" 处理`
        + `（${rest.join('、')} 被忽略）—— 想多个的话请写进 tags`,
      )
      patch.category = first
    }

    return Object.keys(patch).length ? { ...file, ...patch } : file
  },
})
