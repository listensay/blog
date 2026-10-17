import { createReadStream } from 'node:fs'
import { stat, realpath } from 'node:fs/promises'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Workspace } from '../paths.ts'
import { isInside } from '../paths.ts'

const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon' }
export async function serveAffineApp(req: IncomingMessage, res: ServerResponse, ws: Workspace) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (url.pathname !== '/affine-workspace' && !url.pathname.startsWith('/affine-workspace/')) return false
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return true }
  const root = path.join(ws.blogRoot, '.affine/web')
  const relative = decodeURIComponent(url.pathname.slice('/affine-workspace'.length)).replace(/^\//, '')
  const absolute = path.resolve(root, relative)
  if (!isInside(root, absolute) && absolute !== root) { res.writeHead(403).end(); return true }
  let file = absolute
  let info = await stat(file).catch(() => null)
  if (!info?.isFile()) {
    if (path.extname(relative)) { res.writeHead(404).end(); return true }
    file = path.join(root, 'index.html'); info = await stat(file).catch(() => null)
  }
  if (!info?.isFile()) { res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' }).end('工作区尚未构建，请运行 npm run affine:build'); return true }
  if (!isInside(await realpath(root), await realpath(file))) { res.writeHead(403).end(); return true }
  res.setHeader('content-type', TYPES[path.extname(file)] ?? 'application/octet-stream')
  res.setHeader('cache-control', 'no-cache')
  res.setHeader('content-length', info.size)
  res.setHeader('x-content-type-options', 'nosniff')
  if (req.method === 'HEAD') res.end(); else createReadStream(file).pipe(res)
  return true
}
