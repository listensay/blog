import type { Connect, Plugin, ViteDevServer } from 'vite'
import { loadEnv } from 'vite'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'

import type { AiRequest, PageInput, PostInput, WorkspaceInfo } from '../src/types.ts'
import { type AiConfig, aiStatus, resolveAiConfig, runAi } from './ai.ts'
import { PUBLIC_MOUNT, listImages, saveImage } from './images.ts'
import {
  HttpError,
  notFound,
  parseUrl,
  readBody,
  readJson,
  requireQuery,
  sendJson,
} from './http.ts'
import { readNav, writeNav } from './nav.ts'
import { createPage, listPages, readPage, trashPage, updatePage } from './pages.ts'
import { createPost, listPosts, readPost, trashPost, updatePost } from './posts.ts'
import { readSettings, writeSettings } from './settings.ts'
import { type Workspace, isInside, resolveWorkspace } from './paths.ts'

const API_PREFIX = '/api'

const LOCAL_HOSTS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

interface Context {
  ws: Workspace
  ai: AiConfig
}

type Handler = (
  req: Connect.IncomingMessage,
  res: import('node:http').ServerResponse,
  ctx: Context,
) => Promise<void>

const routes: Record<string, Handler> = {
  'GET /workspace': async (_req, res, { ws }) => {
    const [{ posts }, { pages }, images] = await Promise.all([
      listPosts(ws),
      listPages(ws),
      listImages(ws),
    ])
    const info: WorkspaceInfo = {
      blogRoot: ws.blogRoot,
      postCount: posts.length,
      pageCount: pages.length,
      imageCount: images.length,
    }
    sendJson(res, 200, info)
  },

  'GET /posts': async (_req, res, { ws }) => {
    sendJson(res, 200, await listPosts(ws))
  },

  'GET /post': async (req, res, { ws }) => {
    const file = requireQuery(parseUrl(req), 'file')
    sendJson(res, 200, await readPost(ws, file))
  },

  'POST /post': async (req, res, { ws }) => {
    const input = await readJson<PostInput>(req)
    sendJson(res, 201, await createPost(ws, input))
  },

  'PUT /post': async (req, res, { ws }) => {
    const file = requireQuery(parseUrl(req), 'file')
    const input = await readJson<PostInput>(req)
    sendJson(res, 200, await updatePost(ws, file, input))
  },

  'DELETE /post': async (req, res, { ws }) => {
    const file = requireQuery(parseUrl(req), 'file')
    sendJson(res, 200, await trashPost(ws, file))
  },

  'GET /pages': async (_req, res, { ws }) => {
    sendJson(res, 200, await listPages(ws))
  },

  'GET /page': async (req, res, { ws }) => {
    const file = requireQuery(parseUrl(req), 'file')
    sendJson(res, 200, await readPage(ws, file))
  },

  'POST /page': async (req, res, { ws }) => {
    const input = await readJson<PageInput>(req)
    sendJson(res, 201, await createPage(ws, input))
  },

  'PUT /page': async (req, res, { ws }) => {
    const file = requireQuery(parseUrl(req), 'file')
    const input = await readJson<PageInput>(req)
    sendJson(res, 200, await updatePage(ws, file, input))
  },

  'DELETE /page': async (req, res, { ws }) => {
    const file = requireQuery(parseUrl(req), 'file')
    sendJson(res, 200, await trashPage(ws, file))
  },

  'GET /nav': async (_req, res, { ws }) => {
    sendJson(res, 200, await readNav(ws))
  },

  'PUT /nav': async (req, res, { ws }) => {
    const input = await readJson<{ items: unknown }>(req)
    sendJson(res, 200, await writeNav(ws, input.items))
  },

  'GET /settings': async (_req, res, { ws }) => {
    sendJson(res, 200, await readSettings(ws))
  },

  'PUT /settings': async (req, res, { ws }) => {
    const input = await readJson<{ settings: unknown }>(req)
    sendJson(res, 200, await writeSettings(ws, input.settings))
  },

  'GET /images': async (_req, res, { ws }) => {
    sendJson(res, 200, { images: await listImages(ws) })
  },

  'POST /images': async (req, res, { ws }) => {
    const name = requireQuery(parseUrl(req), 'name')
    const data = await readBody(req)
    const { item, reused } = await saveImage(ws, name, data)
    sendJson(res, reused ? 200 : 201, { image: item, reused })
  },

  'GET /ai': async (_req, res, { ai }) => {
    sendJson(res, 200, aiStatus(ai))
  },

  'POST /ai': async (req, res, { ai }) => {
    const input = await readJson<AiRequest>(req)
    sendJson(res, 200, await runAi(ai, input))
  },
}

async function servePublic(
  req: Connect.IncomingMessage,
  res: import('node:http').ServerResponse,
  ws: Workspace,
): Promise<boolean> {
  const url = parseUrl(req)
  if (!url.pathname.startsWith(`${PUBLIC_MOUNT}/`)) return false

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
  let ctx: Context

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
        if (await servePublic(req, res, ctx.ws)) return

        const key = `${req.method ?? 'GET'} ${url.pathname.slice(API_PREFIX.length) || '/'}`
        const handler = routes[key]
        if (!handler) throw notFound(`没有这个接口：${key}`)

        await handler(req, res, ctx)
      } catch (err) {
        if (err instanceof HttpError) {
          sendJson(res, err.status, { error: err.message })
          return
        }
        log(`[blog-admin] ${url.pathname} 出错`, err)
        const message = err instanceof Error ? err.message : String(err)
        sendJson(res, 500, { error: message })
      }
    }

  return {
    name: 'blog-admin-api',
    apply: 'serve',

    configResolved(config) {
      const ws = resolveWorkspace(config.root)

      const fromFiles = loadEnv(config.mode, config.envDir, 'ADMIN_')
      const ai = resolveAiConfig({ ...fromFiles, ...process.env })

      ctx = { ws, ai }
    },

    configureServer(server: ViteDevServer) {
      server.middlewares.use(
        middleware((msg, err) => server.config.logger.error(msg, { error: err as Error })),
      )
      const dim = (text: string) => `\x1b[2m${text}\x1b[0m`
      server.config.logger.info(`  \x1b[32m➜\x1b[0m  ${dim('blog 仓库:')} ${ctx.ws.blogRoot}`)
      server.config.logger.info(
        `  \x1b[32m➜\x1b[0m  ${dim('AI 润色:')} ` +
          (ctx.ai.apiKey
            ? `${ctx.ai.model} ${dim(`@ ${ctx.ai.baseUrl}`)}`
            : dim('未配置（ADMIN_AI_API_KEY）')),
      )
    },

    configurePreviewServer(server) {
      server.middlewares.use(middleware((msg, err) => console.error(msg, err)))
    },
  }
}
