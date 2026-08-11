/**
 * 把 Date 或日期字符串格式化成 “2026年8月11日”
 * 服务端与客户端都用固定 zh-CN 语言环境，避免 hydration 不一致
 */
export function formatDate(input: string | Date | undefined | null): string {
  if (!input) return ''
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(d)
}

/** 生成 <time datetime> 用的 ISO 日期（YYYY-MM-DD） */
export function isoDate(input: string | Date | undefined | null): string {
  if (!input) return ''
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}
