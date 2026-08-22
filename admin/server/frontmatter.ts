/**
 * frontmatter 的读写。
 *
 * 两条硬要求：
 *  1. **正文逐字节保留**。切出 frontmatter 之后，剩下的原文一个字符都不动，
 *     所以「打开文章、什么都不改、点保存」得到的文件和原来完全一样（有测试覆盖）。
 *  2. **不认识的字段也要留着**。schema 之外的 frontmatter 原样带回来再写回去，
 *     不能因为后台不认识就把作者手写的字段吃掉。
 *
 * 日期为什么按字符串处理：`yaml` 包用的是 YAML 1.2 core schema，`date: 2026-08-19`
 * 解析出来就是字符串（js-yaml 那套 YAML 1.1 才会给 Date）。全程按 `YYYY-MM-DD`
 * 字符串传，就不会有「时区把日期挪了一天」这种事。
 */
import YAML from 'yaml'

import type { PostFrontmatter } from '../src/types.ts'

/** frontmatter 里已知字段的书写顺序，和现有文章保持一致 */
const KEY_ORDER = [
  'title',
  'description',
  'date',
  'slug',
  'path',
  'category',
  'tags',
  'draft',
  'cover',
] as const

export interface SplitResult {
  /** frontmatter 解析结果；没有 frontmatter 时是空对象 */
  data: Record<string, unknown>
  /** 分隔符之后的原文，含它开头的空行 */
  body: string
  hasFrontmatter: boolean
}

/**
 * 把文件内容切成 frontmatter + 正文。
 *
 * 手写扫描而不是一个大正则：`---\n---\n`（空 frontmatter）这种边界用正则很容易写错，
 * 而这里错一次的代价是把正文当成 frontmatter 吃掉。
 */
export function splitFrontmatter(input: string): SplitResult {
  // BOM 去掉再判断，否则开头的 `---` 认不出来
  const raw = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input

  if (!/^---[ \t]*\r?\n/.test(raw)) {
    return { data: {}, body: raw, hasFrontmatter: false }
  }

  const afterOpen = raw.indexOf('\n') + 1
  const rest = raw.slice(afterOpen)

  // 单独成行的 `---` 或 `...` 收尾。没有 m 标志，所以 `^` 只匹配 rest 的开头,
  // 正好覆盖「frontmatter 是空的」这种情况
  const close = /(?:^|\n)(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(rest)
  if (!close) {
    // 有开头没结尾：当作没有 frontmatter，正文原样保留，绝不猜
    return { data: {}, body: raw, hasFrontmatter: false }
  }

  const yamlText = rest.slice(0, close.index)
  const body = rest.slice(close.index + close[0].length)

  let data: Record<string, unknown> = {}
  if (yamlText.trim()) {
    const parsed = YAML.parse(yamlText) as unknown
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>
    }
  }

  return { data, body, hasFrontmatter: true }
}

/** 拼回完整文件内容。`body` 原样接在收尾分隔符之后 */
export function serializeFile(data: Record<string, unknown>, body: string): string {
  const ordered: Record<string, unknown> = {}

  for (const key of KEY_ORDER) {
    if (key in data) ordered[key] = data[key]
  }
  // 未知字段排在已知字段后面，保持它们原本的相对顺序
  for (const [key, value] of Object.entries(data)) {
    if (!(key in ordered)) ordered[key] = value
  }

  const yamlText = YAML.stringify(ordered, {
    // 默认 80 列会把长 description 折成多行，diff 很难看
    lineWidth: 0,
    // 空值写成裸键（`tags:`）而不是 `tags: null`。
    // 仓库里确实有文章写着空的 `tags:`，写成 null 就等于改了人家的文件
    nullStr: '',
  })

  return `---\n${yamlText}---\n${body}`
}

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback

/** 标签分隔符和 blog/transformers/taxonomy.ts 对齐：半角/全角逗号和顿号，不切空格 */
const TAG_SEPARATORS = /[,，、]/

function asStringList(value: unknown): string[] {
  const parts =
    typeof value === 'string'
      ? value.split(TAG_SEPARATORS)
      : Array.isArray(value)
        ? value.flatMap((v) => (typeof v === 'string' ? v.split(TAG_SEPARATORS) : [asString(v)]))
        : []

  const seen = new Set<string>()
  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed) seen.add(trimmed)
  }
  return [...seen]
}

/** 只有日期 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
/** 日期 + 时刻（秒可有可无，`T` 或空格分隔都认） */
const DATE_TIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/
/** 结尾带时区（`Z` 或 `+08:00`） */
const HAS_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i

const pad = (n: number) => String(n).padStart(2, '0')

/** Date → 本地时间的 `YYYY-MM-DD HH:mm`（不用 toISOString，UTC 会把日期挪掉） */
function formatLocal(d: Date): string {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

/**
 * 把 frontmatter 里的 date 归一成 `YYYY-MM-DD HH:mm`。
 *
 * **为什么统一到「不带秒」这个格式**：`2026-08-19 09:30` 在 YAML 1.1（js-yaml，
 * 时间戳正则要求带秒）和 YAML 1.2（core schema 压根没有时间戳类型）里**都是纯字符串**，
 * 所以没有任何一层解析会把它变成 Date、也就没有任何时区能把日期挪走。
 * 带秒的 `09:30:00` 反而会被 YAML 1.1 当成 UTC 时间戳，是自找麻烦。
 *
 * 老文章只写了日期 → 当成当天 `00:00`。
 */
export function toDateTimeString(value: unknown): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : formatLocal(value)
  }

  const text = asString(value).trim()
  if (!text) return ''

  if (DATE_ONLY.test(text)) return `${text} 00:00`

  // 显式带时区的写法要真的换算到本地，不能只把墙上时间抄过来
  if (HAS_ZONE.test(text)) {
    const parsed = new Date(text)
    if (!Number.isNaN(parsed.getTime())) return formatLocal(parsed)
  }

  const matched = DATE_TIME.exec(text)
  if (matched) return `${matched[1]} ${matched[2]}:${matched[3]}`

  const parsed = new Date(text)
  // 实在认不出来就原样返回，不猜 —— 让保存时的校验去报错，别悄悄改人家的值
  return Number.isNaN(parsed.getTime()) ? text : formatLocal(parsed)
}

/** frontmatter → 前端要的规整结构 */
export function normalizeFrontmatter(data: Record<string, unknown>): PostFrontmatter {
  return {
    title: asString(data.title),
    description: asString(data.description),
    date: toDateTimeString(data.date),
    slug: asString(data.slug),
    path: asString(data.path),
    category: asString(data.category),
    tags: asStringList(data.tags),
    draft: data.draft === true,
    cover: asString(data.cover),
  }
}

/** schema 给了默认值或可省的字段：值为空时可以整个键都不写 */
const OMITTABLE = ['path', 'category', 'tags', 'draft', 'cover'] as const

/** 某个可省字段在这份 frontmatter 里算不算「空」 */
function isEmptyValue(fm: PostFrontmatter, key: (typeof OMITTABLE)[number]): boolean {
  switch (key) {
    case 'tags':
      return fm.tags.length === 0
    case 'draft':
      return fm.draft === false
    default:
      return fm[key] === ''
  }
}

/**
 * 前端提交的内容 → 要写进文件的 frontmatter。
 *
 * 空值默认不写（`draft: false`、`cover: ''`、`tags: []` 都省掉），让后台产出的文件
 * 和手写的一样干净 —— schema 里这些都有默认值。
 *
 * 但有一种情况必须让路：**文件里本来就写着一个空键**。仓库里确实有文章写着光秃秃的
 * `tags:`（YAML 解析成 null）。如果照「空就不写」的规则处理，等于后台一保存就悄悄
 * 删掉作者写的一行 —— 于是这里区分两种「空」：
 *
 *   - 原文里没有这个键         → 不写（新文章、或者本来就没有）
 *   - 原文里有、而且原本就是空的 → **原样保留原文那个值**（`tags:` 还是 `tags:`）
 *   - 原文里有值、现在被清空了   → 不写（用户主动删的，得听用户的）
 *
 * `raw` 传原文解析出来的整份 frontmatter；新建文章时传空对象即可。
 */
export function buildFrontmatter(
  fm: PostFrontmatter,
  raw: Record<string, unknown> = {},
): Record<string, unknown> {
  // schema 里必填的四个字段，一定写
  const data: Record<string, unknown> = {
    title: fm.title,
    description: fm.description,
    date: fm.date,
    slug: fm.slug,
  }

  /*
   * 日期同理：老文章只写了 `date: 2026-08-19`，后台会把它显示成 `2026-08-19 00:00`。
   * 如果用户没动过时间就把归一化结果写回去，等于每篇老文章一保存就被改一行。
   * 所以只有「归一化后确实和原文不一样」才写新值 —— 用户真的调了时间才落盘。
   */
  if (typeof raw.date === 'string' && toDateTimeString(raw.date) === fm.date) {
    data.date = raw.date
  }

  const originalFm = normalizeFrontmatter(raw)

  for (const key of OMITTABLE) {
    if (!isEmptyValue(fm, key)) {
      data[key] = key === 'draft' ? true : fm[key]
      continue
    }
    // 现在是空的：只有「原文里有这个键、而且原本也是空的」才把原值抄回去
    if (key in raw && isEmptyValue(originalFm, key)) data[key] = raw[key]
  }

  // 后台不认识的字段原样带回去，排在已知字段后面
  const known = new Set<string>(KEY_ORDER)
  for (const [key, value] of Object.entries(raw)) {
    if (!known.has(key) && !(key in data)) data[key] = value
  }

  return data
}
