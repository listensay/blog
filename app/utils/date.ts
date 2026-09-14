import { siteConfig } from './site'

type DateInput = string | number | Date | undefined | null

interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  hasTime: boolean
}

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

export function formatDate(input: DateInput, locale = 'zh-CN'): string {
  const wall = parseWallClock(input)
  if (wall && locale === 'zh-CN') return `${wall.year}年${wall.month}月${wall.day}日`

  const d = wall ? new Date(Date.UTC(wall.year, wall.month - 1, wall.day)) : toDate(input)
  if (!d) return ''
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(d)
}

export function formatDateTime(input: DateInput, locale = 'zh-CN'): string {
  const wall = parseWallClock(input)
  if (!wall || !wall.hasTime) return formatDate(input, locale)

  const isMidnight = wall.hour === 0 && wall.minute === 0
  if (isMidnight) return formatDate(input, locale)

  return `${formatDate(input, locale)} ${pad(wall.hour)}:${pad(wall.minute)}`
}

export function isoDate(input: DateInput): string {
  const wall = parseWallClock(input)
  if (wall) return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`

  const d = toDate(input)
  return d ? d.toISOString().slice(0, 10) : ''
}

export function isoDateTime(input: DateInput): string {
  const wall = parseWallClock(input)
  if (wall) {
    const date = `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`
    return `${date}T${pad(wall.hour)}:${pad(wall.minute)}:00${siteConfig.utcOffset}`
  }

  const d = toDate(input)
  return d ? d.toISOString() : ''
}

export function relativeTime(input: DateInput, now: number = Date.now(), locale = 'zh-CN'): string {
  const d = toDate(parseWallClock(input) ? isoDateTime(input) : input)
  if (!d) return ''

  const diff = now - d.getTime()
  if (locale === 'en') {
    if (diff < 60_000) return 'Just now'
    const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
    if (diff < 3_600_000) return relative.format(-Math.floor(diff / 60_000), 'minute')
    if (diff < 86_400_000) return relative.format(-Math.floor(diff / 3_600_000), 'hour')
    if (diff < 30 * 86_400_000) return relative.format(-Math.floor(diff / 86_400_000), 'day')
    return formatDate(d, locale)
  }
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

export function localDateTime(input: DateInput, locale = 'zh-CN'): string {
  const d = toDate(parseWallClock(input) ? isoDateTime(input) : input)
  if (!d) return ''
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}
