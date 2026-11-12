import type { IncomingMessage, ServerResponse } from 'node:http'
import { createReadStream } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'

import { LocalAffineService } from './affine-local/service.ts'
import { WorkspaceChanges } from './changes.ts'
import { serveAffineApp } from './affine-local/assets.ts'
import { withSyncLock } from './affine/sync.ts'
import { readDashboard } from './dashboard.ts'
import {
  PUBLIC_MOUNT,
  deleteUnusedImages,
  findUnusedImages,
  listImages,
  saveImage,
} from './images.ts'
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
import { listPages, readPage, writeFriends } from './pages.ts'
import { readSettings, writeSettings } from './settings.ts'
import { type Workspace, isInside } from './paths.ts'
import { CommentAdmin } from './comments.ts'

const API_PREFIX = '/api'

interface Context {
  ws: Workspace
  affine: LocalAffineService
  changes: WorkspaceChanges
  comments: CommentAdmin
}

type Handler = (req: IncomingMessage, res: ServerResponse, ctx: Context) => Promise<void>

const routes: Record<string, Handler> = {
  'GET /comments/session': async (_req, res, { comments }) => {
    sendJson(res, 200, await comments.session())
  },
  'POST /comments/login': async (req, res, { comments }) => {
    sendJson(res, 200, await comments.login(await readJson(req)))
  },
  'POST /comments/logout': async (_req, res, { comments }) => {
    sendJson(res, 200, await comments.logout())
  },
  'GET /comments': async (req, res, { comments }) => {
    const url = parseUrl(req)
    sendJson(
      res,
      200,
      await comments.list(
        url.searchParams.get('status') || 'all',
        url.searchParams.get('offset') || '0',
      ),
    )
  },
  'POST /comments/action': async (req, res, { comments }) => {
    sendJson(res, 200, await comments.act(await readJson(req)))
  },
  'GET /events': async (_req, res, { changes }) => {
    changes.connect(res)
  },
  'GET /dashboard': async (_req, res, { ws }) => {
    sendJson(res, 200, await readDashboard(ws))
  },

  'GET /affine': async (_req, res, { affine }) => {
    sendJson(res, 200, await affine.status())
  },
  'POST /affine-local/invoke': async (req, res, { affine }) => {
    const input = await readJson<{ command: unknown; args: Record<string, unknown> }>(req)
    if (!input || !input.args || typeof input.args !== 'object' || Array.isArray(input.args))
      throw new HttpError(400, '工作区请求无效')
    sendJson(res, 200, await affine.invoke(input.command, input.args))
  },
  'GET /pages': async (_req, res, { ws }) => {
    sendJson(res, 200, await listPages(ws))
  },
  'GET /links': async (_req, res, { ws }) => {
    sendJson(res, 200, await readPage(ws, 'pages/links.md'))
  },
  'PUT /links': async (req, res, { ws }) => {
    const input = await readJson<{ friends: unknown }>(req)
    sendJson(res, 200, await withSyncLock(ws, () => writeFriends(ws, input?.friends)))
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

  'GET /images/unused': async (_req, res, { ws }) => {
    sendJson(res, 200, await findUnusedImages(ws))
  },

  'POST /images/cleanup': async (req, res, { ws }) => {
    const input = await readJson<{ names: unknown }>(req)
    sendJson(res, 200, await deleteUnusedImages(ws, input.names))
  },
}

async function servePublic(
  req: IncomingMessage,
  res: ServerResponse,
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
    if (!isInside(await realpath(ws.publicDir), await realpath(absolute))) {
      res.writeHead(403).end()
      return true
    }

    res.statusCode = 200
    res.setHeader('content-type', contentTypeOf(absolute))
    res.setHeader('content-length', String(stats.size))
    res.setHeader('cache-control', 'no-store')
    createReadStream(absolute)
      .on('error', () => res.destroy())
      .pipe(res)
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

export function createAdminApi(
  ws: Workspace,
  affineRoot: string,
  env: Record<string, string> = {},
) {
  const ctx: Context = {
    ws,
    affine: new LocalAffineService(ws, env, affineRoot),
    changes: new WorkspaceChanges(ws),
    comments: new CommentAdmin(ws),
  }
  return {
    async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
      const url = parseUrl(req)
      if (await serveAffineApp(req, res, affineRoot)) return true
      if (await servePublic(req, res, ws)) return true
      if (!url.pathname.startsWith(`${API_PREFIX}/`)) return false
      const key = `${req.method ?? 'GET'} ${url.pathname.slice(API_PREFIX.length)}`
      const handler = routes[key]
      if (!handler) throw notFound('接口不存在')
      await handler(req, res, ctx)
      return true
    },
    close() {
      ctx.changes.close()
      ctx.comments.close()
      ctx.affine.stop()
    },
  }
}
