/*
 * 日期格式化。
 *
 * 这里有两类完全不同的输入，混着处理必出错，所以显式分开：
 *
 * 1. **文章的 `date`** —— frontmatter 里写的是「墙上时间」字符串
 *    `YYYY-MM-DD HH:mm`（作者本地时区，见 admin/README.md）。
 *    这类输入**一步都不经过 `Date`**，直接按字符串拆成年月日时分再拼回去。
 *
 *    为什么不能经过 Date：`new Date('2026-08-19')` 按 UTC 解析，
 *    `new Date('2026-08-19 09:30')` 按**本地**解析，同一个函数会给出不同的日期；
 *    而且站点 SSR 跑在 Cloudflare Workers 上（时区是 UTC）、浏览器在 +08，
 *    「构造本地 Date 再按某个时区格式化」在两边算出来的结果不一样 ——
 *    既会 hydration 不一致，显示的时刻也是错的。
 *
 * 2. **评论的 `createdAt`** —— D1 里存的是完整 ISO 时间戳（真实瞬间，带 Z）。
 *    这类继续走 `new Date()`，行为和以前一致。
 */
import { siteConfig } from './site'

type DateInput = string | number | Date | undefined | null

interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  /** 原文有没有写时刻。只写了日期的老文章按 00:00 处理，但显示时不该凭空多出一个 00:00 */
  hasTime: boolean
}

/** 只认 `YYYY-MM-DD` 和 `YYYY-MM-DD HH:mm`（admin 写出来的固定格式） */
const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/

function parseWallClock(input: DateInput): WallClock | null {
  if (typeof input !== 'string') return null

  const matched = WALL_CLOCK.exec(input.trim())
  if (!matched) return null

  const [, year, month, day, hour, minute] = matched
  const parts = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour ?? 0),
    minute: Number(minute ?? 0),
    hasTime: hour !== undefined,
  }

  // 日历上不存在的日期（2026-02-31 之类）当作无效，交给调用方回退
  if (parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > 31) return null
  if (parts.hour > 23 || parts.minute > 59) return null

  return parts
}

function toDate(input: DateInput): Date | null {
  if (input === undefined || input === null || input === '') return null
  const d = input instanceof Date ? input : new Date(input)
  return Number.isNaN(d.getTime()) ? null : d
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * “2026年8月19日”。
 * 固定用 zh-CN + UTC，服务端和客户端结果一致，不会 hydration 报错。
 */
export function formatDate(input: DateInput): string {
  const wall = parseWallClock(input)
  if (wall) return `${wall.year}年${wall.month}月${wall.day}日`

  const d = toDate(input)
  if (!d) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(d)
}

/**
 * “2026年8月19日 09:30”。文章的发布时间用这个。
 *
 * **`00:00` 不显示时刻**，退化成 formatDate。因为 `00:00` 在这个仓库里就是
 * 「只知道日期、没记时刻」的占位值 —— 老文章从纯日期迁移过来时统一补的就是它
 * （见 admin/README.md）。真按 0 点发的文章会因此少显示一个时刻，这个代价换来的是
 * 几十篇老文章的页面上不会整齐地挂一排没有意义的 00:00。
 * 想让 00:00 也显示出来，把下面那行 `isMidnight` 判断删掉即可。
 */
export function formatDateTime(input: DateInput): string {
  const wall = parseWallClock(input)
  if (!wall || !wall.hasTime) return formatDate(input)

  const isMidnight = wall.hour === 0 && wall.minute === 0
  if (isMidnight) return formatDate(input)

  return `${wall.year}年${wall.month}月${wall.day}日 ${pad(wall.hour)}:${pad(wall.minute)}`
}

/** 生成 <time datetime> 用的 ISO 日期（YYYY-MM-DD） */
export function isoDate(input: DateInput): string {
  const wall = parseWallClock(input)
  if (wall) return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`

  const d = toDate(input)
  return d ? d.toISOString().slice(0, 10) : ''
}

/**
 * 完整时间戳，给 <time datetime>、og:published_time、JSON-LD 用。
 *
 * 文章的墙上时间要补上站点时区偏移才是一个明确的瞬间（siteConfig.utcOffset），
 * 不能直接当成 UTC —— 那会让 SEO 里的发布时间差 8 小时。
 */
export function isoDateTime(input: DateInput): string {
  const wall = parseWallClock(input)
  if (wall) {
    const date = `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`
    return `${date}T${pad(wall.hour)}:${pad(wall.minute)}:00${siteConfig.utcOffset}`
  }

  const d = toDate(input)
  return d ? d.toISOString() : ''
}

/**
 * “刚刚 / 12 分钟前 / 3 小时前 / 5 天前”，超过一个月就显示日期。
 * 结果依赖“现在”，只能在客户端调用；服务端渲染请用 formatDate。
 */
export function relativeTime(input: DateInput, now: number = Date.now()): string {
  // 文章的墙上时间先补上站点时区，才能和“现在”做减法
  const d = toDate(parseWallClock(input) ? isoDateTime(input) : input)
  if (!d) return ''

  const diff = now - d.getTime()
  if (diff < 0) return '刚刚'

  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`
  return formatDate(d)
}

/**
 * 读者本地时区的完整时间，用于 title 悬浮提示。
 * 同样只在客户端调用——服务端时区和读者的不一样。
 */
export function localDateTime(input: DateInput): string {
  const d = toDate(parseWallClock(input) ? isoDateTime(input) : input)
  if (!d) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}
