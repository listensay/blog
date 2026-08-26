import type { H3Event } from 'h3'

export function httpError(statusCode: number, message: string) {
  return createError({ statusCode, message })
}

export function noStore(event: H3Event) {
  setHeader(event, 'cache-control', 'no-store, max-age=0')
}
