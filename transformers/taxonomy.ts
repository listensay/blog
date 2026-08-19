import { defineTransformer } from '@nuxt/content'

/**
 * 归一化 frontmatter 里的分类与标签。
 *
 * 起因：`tags: AI` 这种写法 YAML 会解析成**字符串** `"AI"` 而不是数组。
 * schema 声明的是 `z.array(z.string())` 但并不会拦住它，于是模板里
 * `v-for="t in post.tags"` 对字符串逐字符迭代，页面上出现两个标签「A」「I」
 * （`tags?.length` 恰好是 2，连显示判断都通过了，所以看起来不像 bug）。
 *
 * 这里把 tags 一律修成干净的字符串数组，让写 `tags: AI`、`tags: AI, 白嫖`、
 * `tags:`（空）都得到符合预期的结果。
 */

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

    // category 按设计一篇只有一个（它是普通字符串列，分类页靠 SQL 直接 .where 过滤）。
    // 写成 `category: 福利，AI` 会生成一个名字叫「福利，AI」的分类 —— 取首段并告警，
    // 别让一个手滑的逗号在分类页里长出个怪名字。
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
