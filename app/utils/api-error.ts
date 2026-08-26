const GENERIC = new Set(['Server Error', 'Internal Server Error', 'Bad Request', 'Unauthorized'])

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
