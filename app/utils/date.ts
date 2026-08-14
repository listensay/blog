type DateInput = string | number | Date | undefined | null

function toDate(input: DateInput): Date | null {
  if (input === undefined || input === null || input === '') return null
  const d = input instanceof Date ? input : new Date(input)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * 把 Date 或日期字符串格式化成 “2026年8月11日”
 * 服务端与客户端都用固定 zh-CN 语言环境，避免 hydration 不一致
 */
export function formatDate(input: DateInput): string {
  const d = toDate(input)
  if (!d) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(d)
}

/** 生成 <time datetime> 用的 ISO 日期（YYYY-MM-DD） */
export function isoDate(input: DateInput): string {
  const d = toDate(input)
  return d ? d.toISOString().slice(0, 10) : ''
}

/** 完整时间戳，给 <time datetime> 用 */
export function isoDateTime(input: DateInput): string {
  const d = toDate(input)
  return d ? d.toISOString() : ''
}

/**
 * “刚刚 / 12 分钟前 / 3 小时前 / 5 天前”，超过一个月就显示日期。
 * 结果依赖“现在”，只能在客户端调用；服务端渲染请用 formatDate。
 */
export function relativeTime(input: DateInput, now: number = Date.now()): string {
  const d = toDate(input)
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
  const d = toDate(input)
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
