/** 服务端兜底的通用错误话术，出现这些说明没拿到具体原因 */
const GENERIC = new Set(['Server Error', 'Internal Server Error', 'Bad Request', 'Unauthorized'])

/**
 * 从 $fetch 抛出的错误里取出可以直接给用户看的话。
 * 服务端的 httpError() 只把中文提示写进 message（h3 会清洗 statusMessage），
 * 所以这里优先读 message，剩下两个只是兜底。
 */
export function apiErrorMessage(error: unknown, fallback = '出错了，稍后再试'): string {
  const e = error as {
    data?: { statusMessage?: string, message?: string }
    statusMessage?: string
  }

  for (const candidate of [e?.data?.message, e?.data?.statusMessage, e?.statusMessage]) {
    if (candidate && !GENERIC.has(candidate)) return candidate
  }

  return fallback
}
