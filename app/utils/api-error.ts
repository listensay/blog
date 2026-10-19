const GENERIC = new Set(['Server Error', 'Internal Server Error', 'Bad Request', 'Unauthorized'])

export function apiErrorMessage(error: unknown, fallback = '请求失败，请重试'): string {
  const e = error as {
    data?: { statusMessage?: string, message?: string }
    statusMessage?: string
  }

  for (const candidate of [e?.data?.message, e?.data?.statusMessage, e?.statusMessage]) {
    if (candidate && !GENERIC.has(candidate)) return candidate
  }

  return fallback
}
