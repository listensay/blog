/**
 * 把「读写 blog 仓库」这件事做成一个 Vite 插件。
 *
 * 这样 `npm run dev` 一条命令就够了：Vite 既是前端 dev server，也是唯一那个能碰
 * 文件系统的进程，不用另起 Express、不用配 proxy、也完全不动 blog 项目的代码。
 *
 * 只在 dev（和 preview）里挂载 —— `apply: 'serve'`。这个后台按设计**不上线**：
 * 接口没有任何鉴权，谁能访问这个端口就能改仓库里的文件。
 */
import type { Connect, Plugin, ViteDevServer } from 'vite'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'

import type { PostInput, WorkspaceInfo } from '../src/types.ts'
import { PUBLIC_MOUNT, listImages, saveImage } from './images.ts'
import { HttpError, notFound, parseUrl, readBody, readJson, requireQuery, sendJson } from './http.ts'
import { createPost, listPosts, readPost, trashPost, updatePost } from './posts.ts'
import { type Workspace, isInside, resolveWorkspace } from './paths.ts'

/** API 前缀。前端统一打 `/api/...`，同源，不涉及 CORS */
const API_PREFIX = '/api'

/** 只允许本机访问。远端 IP 一律拒绝，避免局域网里别人能改你仓库 */
const LOCAL_HOSTS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

type Handler = (
  req: Connect.IncomingMessage,
  res: import('node:http').ServerResponse,
  ws: Workspace,
) => Promise<void>

/** `GET /api/posts` 之类的路由表，key 是 `METHOD /path` */
const routes: Record<string, Handler> = {
  'GET /workspace': async (_req, res, ws) => {
    const [{ posts }, images] = await Promise.all([listPosts(ws), listImages(ws)])
    const info: WorkspaceInfo = {
      blogRoot: ws.blogRoot,
      postCount: posts.length,
      imageCount: images.length,
    }
    sendJson(res, 200, info)
  },

  'GET /posts': async (_req, res, ws) => {
    sendJson(res, 200, await listPosts(ws))
  },

  'GET /post': async (req, res, ws) => {
    const file = requireQuery(parseUrl(req), 'file')
    sendJson(res, 200, await readPost(ws, file))
  },

  'POST /post': async (req, res, ws) => {
    const input = await readJson<PostInput>(req)
    sendJson(res, 201, await createPost(ws, input))
  },

  'PUT /post': async (req, res, ws) => {
    const file = requireQuery(parseUrl(req), 'file')
    const input = await readJson<PostInput>(req)
    sendJson(res, 200, await updatePost(ws, file, input))
  },

  'DELETE /post': async (req, res, ws) => {
    const file = requireQuery(parseUrl(req), 'file')
    sendJson(res, 200, await trashPost(ws, file))
  },

  'GET /images': async (_req, res, ws) => {
    sendJson(res, 200, { images: await listImages(ws) })
  },

  // 图片走裸 body 上传（`?name=x.png` + 二进制正文），不用 multipart：
  // 前端手里本来就是 File/Blob，直接 fetch(body: blob) 最省事，也不用引解析库
  'POST /images': async (req, res, ws) => {
    const name = requireQuery(parseUrl(req), 'name')
    const data = await readBody(req)
    const { item, reused } = await saveImage(ws, name, data)
    sendJson(res, reused ? 200 : 201, { image: item, reused })
  },
}

/** 静态伺服 blog/public，让编辑器里的图片能预览 */
async function servePublic(
  req: Connect.IncomingMessage,
  res: import('node:http').ServerResponse,
  ws: Workspace,
): Promise<boolean> {
  const url = parseUrl(req)
  if (!url.pathname.startsWith(`${PUBLIC_MOUNT}/`)) return false

  // decodeURIComponent 会对残缺的 % 序列抛错，别让它把 dev server 带崩
  let relative: string
  try {
    relative = decodeURIComponent(url.pathname.slice(PUBLIC_MOUNT.length + 1))
  } catch {
    res.statusCode = 400
    res.end('bad path')
    return true
  }

  const absolute = path.resolve(ws.publicDir, relative)
  if (!isInside(ws.publicDir, absolute)) {
    res.statusCode = 403
    res.end('forbidden')
    return true
  }

  try {
    const stats = await stat(absolute)
    if (!stats.isFile()) throw new Error('not a file')

    res.statusCode = 200
    res.setHeader('content-type', contentTypeOf(absolute))
    res.setHeader('content-length', String(stats.size))
    // 图片可能被覆盖（同名换图），不缓存，省得看到旧图以为没生效
    res.setHeader('cache-control', 'no-store')
    createReadStream(absolute).pipe(res)
  } catch {
    res.statusCode = 404
    res.end('not found')
  }

  return true
}

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
}

function contentTypeOf(file: string): string {
  return MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
}

function isLocal(req: Connect.IncomingMessage): boolean {
  const address = req.socket.remoteAddress
  return !address || LOCAL_HOSTS.has(address)
}

export function blogAdminApi(): Plugin {
  let ws: Workspace

  /** dev 和 preview 共用同一套中间件 */
  const middleware =
    (log: (msg: string, err: unknown) => void): Connect.NextHandleFunction =>
    async (req, res, next) => {
      const url = parseUrl(req)
      const isApi = url.pathname === API_PREFIX || url.pathname.startsWith(`${API_PREFIX}/`)
      const isPublic = url.pathname.startsWith(`${PUBLIC_MOUNT}/`)
      if (!isApi && !isPublic) return next()

      if (!isLocal(req)) {
        sendJson(res, 403, { error: '这个后台只允许本机访问' })
        return
      }

      try {
        if (await servePublic(req, res, ws)) return

        const key = `${req.method ?? 'GET'} ${url.pathname.slice(API_PREFIX.length) || '/'}`
        const handler = routes[key]
        if (!handler) throw notFound(`没有这个接口：${key}`)

        await handler(req, res, ws)
      } catch (err) {
        if (err instanceof HttpError) {
          sendJson(res, err.status, { error: err.message })
          return
        }
        // 预期外的错误：控制台留完整堆栈，界面上只给一句话
        log(`[blog-admin] ${url.pathname} 出错`, err)
        const message = err instanceof Error ? err.message : String(err)
        sendJson(res, 500, { error: message })
      }
    }

  return {
    name: 'blog-admin-api',
    apply: 'serve',

    configResolved(config) {
      // config.root 就是 admin 目录；blog 根默认取它的上一级
      ws = resolveWorkspace(config.root)
    },

    configureServer(server: ViteDevServer) {
      server.middlewares.use(
        middleware((msg, err) => server.config.logger.error(msg, { error: err as Error })),
      )
      server.config.logger.info(`  \x1b[32m➜\x1b[0m  \x1b[2mblog 仓库:\x1b[0m ${ws.blogRoot}`)
    },

    // `npm run build && npm run preview` 也能用，接口行为和 dev 完全一致
    configurePreviewServer(server) {
      server.middlewares.use(middleware((msg, err) => console.error(msg, err)))
    },
  }
}
