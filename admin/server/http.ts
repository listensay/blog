import type { IncomingMessage, ServerResponse } from 'node:http'

export class HttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg)
export const notFound = (msg: string) => new HttpError(404, msg)
export const conflict = (msg: string) => new HttpError(409, msg)

const BODY_LIMIT = 32 * 1024 * 1024

export function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const payload = JSON.stringify(data)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(payload)
}

export function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > BODY_LIMIT) {
        reject(new HttpError(413, `请求体超过 ${Math.round(BODY_LIMIT / 1024 / 1024)}MB`))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export async function readJson<T>(req: IncomingMessage): Promise<T> {
  const raw = (await readBody(req)).toString('utf8')
  if (!raw.trim()) throw badRequest('请求体是空的')
  try {
    return JSON.parse(raw) as T
  } catch {
    throw badRequest('请求体不是合法 JSON')
  }
}

export function parseUrl(req: IncomingMessage): URL {
  return new URL(req.url ?? '/', 'http://localhost')
}

export function requireQuery(url: URL, key: string): string {
  const value = url.searchParams.get(key)
  if (!value) throw badRequest(`缺少查询参数 ${key}`)
  return value
}
