/**
 * 一点点 HTTP 胶水。这层刻意不引框架：整个后台只有几个接口，
 * 而 Vite dev server 的 `server.middlewares` 就是原生 connect。
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * 带状态码的错误。handler 里 throw 它，最外层统一转成 JSON 响应。
 *
 * 刻意不用 TS 的构造器参数属性（`constructor(readonly status: number)`）：那是
 * 类型系统专有语法，`node xxx.ts` 的类型擦除跑不了，会挡住直接用 node 跑测试脚本。
 */
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

/** 请求体上限 32MB：粘贴的截图走这条路，留够余量 */
const BODY_LIMIT = 32 * 1024 * 1024

export function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const payload = JSON.stringify(data)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  // 后台数据随时在变，别让任何一层缓存住
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

/**
 * 取查询参数。`req.url` 在 connect 里是被中间件挂载路径截过的相对路径，
 * 所以拿一个占位 origin 出来解析。
 */
export function parseUrl(req: IncomingMessage): URL {
  return new URL(req.url ?? '/', 'http://localhost')
}

export function requireQuery(url: URL, key: string): string {
  const value = url.searchParams.get(key)
  if (!value) throw badRequest(`缺少查询参数 ${key}`)
  return value
}
