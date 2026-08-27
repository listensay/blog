import { existsSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { badRequest } from './http.ts'

export interface Workspace {
  blogRoot: string
  contentDir: string
  postsDir: string
  pagesDir: string
  navFile: string
  siteFile: string
  publicDir: string
  imagesDir: string
  trashDir: string
}

export const POSTS_PREFIX = 'blog'

export const PAGES_PREFIX = 'pages'

export function resolveWorkspace(adminRoot: string): Workspace {
  const fromEnv = process.env.ADMIN_BLOG_ROOT?.trim()
  const blogRoot = fromEnv ? path.resolve(adminRoot, fromEnv) : path.resolve(adminRoot, '..')

  const ws: Workspace = {
    blogRoot,
    contentDir: path.join(blogRoot, 'content'),
    postsDir: path.join(blogRoot, 'content', 'blog'),
    pagesDir: path.join(blogRoot, 'content', 'pages'),
    navFile: path.join(blogRoot, 'content', 'data', 'nav.json'),
    siteFile: path.join(blogRoot, 'content', 'data', 'site.json'),
    publicDir: path.join(blogRoot, 'public'),
    imagesDir: path.join(blogRoot, 'public', 'images'),
    trashDir: path.join(adminRoot, '.trash'),
  }

  for (const dir of [ws.contentDir, ws.postsDir, ws.publicDir] as const) {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      throw new Error(
        `[blog-admin] 找不到目录 ${dir}\n` +
          `  推断出的 blog 根目录是 ${blogRoot}\n` +
          `  如果 admin 不在 blog 仓库里面，用 ADMIN_BLOG_ROOT 环境变量指定 blog 根目录。`,
      )
    }
  }

  return ws
}

export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true })
}

function assertSafeRelative(relative: string, label: string): void {
  if (!relative || relative.includes('\0')) throw badRequest(`${label} 不合法`)
  if (path.posix.isAbsolute(relative) || path.win32.isAbsolute(relative)) {
    throw badRequest(`${label} 必须是相对路径：${relative}`)
  }
  if (relative.split(/[/\\]/).some((seg) => seg === '..')) {
    throw badRequest(`${label} 不允许包含 ..：${relative}`)
  }
}

export function resolvePostFile(ws: Workspace, file: string): string {
  return resolveContentFile(ws.postsDir, ws.contentDir, file, POSTS_PREFIX, '文章目录')
}

export function resolvePageFile(ws: Workspace, file: string): string {
  return resolveContentFile(ws.pagesDir, ws.contentDir, file, PAGES_PREFIX, '页面目录')
}

function resolveContentFile(
  rootDir: string,
  contentDir: string,
  file: string,
  prefix: string,
  label: string,
): string {
  assertSafeRelative(file, 'file')
  if (!file.startsWith(`${prefix}/`)) {
    throw badRequest(`file 必须以 ${prefix}/ 开头：${file}`)
  }
  if (!file.toLowerCase().endsWith('.md')) throw badRequest(`只能操作 .md 文件：${file}`)

  const absolute = path.resolve(contentDir, file)
  if (!isInside(rootDir, absolute)) throw badRequest(`file 超出${label}：${file}`)
  return absolute
}

export function resolveImageFile(ws: Workspace, name: string): string {
  assertSafeRelative(name, 'name')
  if (name.includes('/') || name.includes('\\')) throw badRequest(`图片名不能带目录：${name}`)

  const absolute = path.resolve(ws.imagesDir, name)
  if (!isInside(ws.imagesDir, absolute)) throw badRequest(`图片名不合法：${name}`)
  return absolute
}

export function isInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

export function toPosix(p: string): string {
  return p.split(path.sep).join('/')
}
