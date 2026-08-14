import type { H3Event } from 'h3'

/**
 * 统一造错误：中文提示只写进 message。
 *
 * h3 会对非 ASCII 的 statusMessage 发警告，并且将来要默认清洗它，
 * 所以给用户看的话一律放 message；状态行保持标准英文短语。
 */
export function httpError(statusCode: number, message: string) {
  return createError({ statusCode, message })
}

/**
 * 禁止任何中间层缓存。
 * 这些接口的返回值跟访客有关（是否点过赞）或要求实时（评论列表、后台数据），
 * 一旦被共享缓存命中就会把 A 的状态发给 B。
 */
export function noStore(event: H3Event) {
  setHeader(event, 'cache-control', 'no-store, max-age=0')
}
