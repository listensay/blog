import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createReadStream } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import path from 'node:path'
import { createAdminApi } from './blog-api.ts'
import { HttpError, sendJson } from './http.ts'
import { isInside, type Workspace } from './paths.ts'

const COOKIE = 'blog_desktop'
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
}

function equal(a: string, b: string) {
  const left = Buffer.from(a),
    right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

async function serveFrontend(req: IncomingMessage, res: ServerResponse, root: string) {
  if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, '请求方法不支持')
  const url = new URL(req.url ?? '/', 'http://localhost')
  let relative: string
  try {
    relative = decodeURIComponent(url.pathname).replace(/^\//, '')
  } catch {
    throw new HttpError(400, '地址无效')
  }
  let file = path.resolve(root, relative)
  if (!isInside(root, file)) throw new HttpError(403, '地址无效')
  let info = await stat(file).catch(() => null)
  if (!info?.isFile()) {
    if (path.extname(relative)) throw new HttpError(404, '文件不存在')
    file = path.join(root, 'index.html')
    info = await stat(file)
  }
  if (!isInside(await realpath(root), await realpath(file))) throw new HttpError(403, '地址无效')
  res.setHeader('content-type', MIME[path.extname(file)] ?? 'application/octet-stream')
  res.setHeader('content-length', info.size)
  res.setHeader('cache-control', 'no-cache')
  if (req.method === 'HEAD') res.end()
  else
    createReadStream(file)
      .on('error', () => res.destroy())
      .pipe(res)
}

export async function startDesktopServer(options: {
  workspace: Workspace
  frontendRoot: string
  affineRoot: string
  env?: Record<string, string>
}) {
  const token = randomBytes(32).toString('hex')
  const api = createAdminApi(options.workspace, options.affineRoot, options.env)
  let origin = ''
  let bootstrapped = false
  const server = createServer(async (req, res) => {
    res.setHeader('x-content-type-options', 'nosniff')
    res.setHeader('referrer-policy', 'no-referrer')
    res.setHeader('x-frame-options', 'SAMEORIGIN')
    res.setHeader(
      'content-security-policy',
      "frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
    )
    try {
      if (req.socket.remoteAddress !== '127.0.0.1' || `http://${req.headers.host}` !== origin)
        throw new HttpError(403, '访问被拒绝')
      if (
        (req.headers.origin && req.headers.origin !== origin) ||
        req.headers['sec-fetch-site'] === 'cross-site'
      )
        throw new HttpError(403, '不允许跨站访问本地后台')
      const url = new URL(req.url ?? '/', origin)
      if (
        !bootstrapped &&
        req.method === 'GET' &&
        url.pathname === '/__desktop' &&
        equal(url.searchParams.get('token') ?? '', token)
      ) {
        bootstrapped = true
        res
          .writeHead(303, {
            location: '/',
            'set-cookie': `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/`,
            'cache-control': 'no-store',
          })
          .end()
        return
      }
      const cookie =
        req.headers.cookie
          ?.split(';')
          .map((value) => value.trim())
          .find((value) => value.startsWith(`${COOKIE}=`))
          ?.slice(COOKIE.length + 1) ?? ''
      if (!equal(cookie, token)) throw new HttpError(401, '请从桌面应用打开后台')
      if (await api.handle(req, res)) return
      await serveFrontend(req, res, options.frontendRoot)
    } catch (error) {
      if (res.headersSent) {
        res.destroy()
        return
      }
      sendJson(res, error instanceof HttpError ? error.status : 500, {
        error: error instanceof Error ? error.message : '请求失败',
      })
    }
  })
  server.requestTimeout = 150_000
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
  } catch (error) {
    api.close()
    throw error
  }
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('无法启动本地服务')
  origin = `http://127.0.0.1:${address.port}`
  let closed = false
  return {
    url: `${origin}/__desktop?token=${token}`,
    async close() {
      if (closed) return
      closed = true
      await new Promise<void>((resolve) => {
        server.close(() => resolve())
        server.closeAllConnections()
      })
      api.close()
    },
  }
}
