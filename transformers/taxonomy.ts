import { defineTransformer } from '@nuxt/content'

// 归一化 frontmatter 的分类与标签：`tags: AI` 被 YAML 解析成字符串（schema 拦不住），
// 模板 v-for 会逐字符迭代出「A」「I」两个标签。这里一律修成干净的字符串数组

/** 标签分隔符：半角/全角逗号和顿号。**不切空格** —— 标签本身可能带空格 */
const TAG_SEPARATORS = /[,，、]/

/** 把任意 frontmatter 值收成干净的字符串数组 */
function toStringList(input: unknown): string[] {
  const raw = typeof input === 'string'
    ? input.split(TAG_SEPARATORS)
    : Array.isArray(input)
      // 数组里也可能混着 `- AI, 白嫖` 这种一项写多个的
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

    // tags：字符串 / null / 混写都收成数组。已经是干净数组时也会走一遍
    // （去空项、去重、trim），代价可忽略，好处是入库结构永远一致。
    if ('tags' in f) {
      patch.tags = toStringList(f.tags)
    }

    // 一篇只能有一个 category：写成 `category: 福利，AI` 会长出一个叫「福利，AI」的分类，
    // 所以取首段并告警
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
