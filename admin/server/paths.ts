/**
 * 定位 blog 仓库里的几个目录，并且把「相对 content/ 的路径」安全地还原成绝对路径。
 *
 * 后台只允许碰三个地方：
 *   - `content/blog/**.md`   文章
 *   - `public/images/`       图片
 *   - `admin/.trash/`        删掉的文章挪过去（不是真删，误删能捞回来）
 * 其余路径一律拒绝，避免一个手写的 `?file=../../.env` 就把仓库外的文件读出来。
 */
import { existsSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { badRequest } from './http.ts'

export interface Workspace {
  /** blog 项目根（绝对路径） */
  blogRoot: string
  /** `<blogRoot>/content` */
  contentDir: string
  /** `<blogRoot>/content/blog`，文章都在这下面 */
  postsDir: string
  /** `<blogRoot>/public` */
  publicDir: string
  /** `<blogRoot>/public/images` */
  imagesDir: string
  /** `<adminRoot>/.trash` */
  trashDir: string
}

/** 文章路径的集合前缀。`file` 一律形如 `blog/ai/xxx.md` */
export const POSTS_PREFIX = 'blog'

/**
 * 解析工作区。
 *
 * `adminRoot` 传 Vite 的 `config.root`（也就是 admin 目录）；blog 根默认是它的上一级，
 * 可以用环境变量 `ADMIN_BLOG_ROOT` 覆盖 —— 验证脚本靠它指到临时副本上，
 * 不然测试会写到真仓库里。
 */
export function resolveWorkspace(adminRoot: string): Workspace {
  const fromEnv = process.env.ADMIN_BLOG_ROOT?.trim()
  const blogRoot = fromEnv ? path.resolve(adminRoot, fromEnv) : path.resolve(adminRoot, '..')

  const ws: Workspace = {
    blogRoot,
    contentDir: path.join(blogRoot, 'content'),
    postsDir: path.join(blogRoot, 'content', 'blog'),
    publicDir: path.join(blogRoot, 'public'),
    imagesDir: path.join(blogRoot, 'public', 'images'),
    trashDir: path.join(adminRoot, '.trash'),
  }

  // 目录不对就直接说清楚是哪个不对，别等到第一次请求才报一个 ENOENT
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

/** 需要写文件时才建目录，避免空跑一次就在仓库里留下空文件夹 */
export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true })
}

/** 路径里出现这些就直接拒绝：`..` 跳出去、绝对路径、盘符、NUL 截断 */
function assertSafeRelative(relative: string, label: string): void {
  if (!relative || relative.includes('\0')) throw badRequest(`${label} 不合法`)
  if (path.posix.isAbsolute(relative) || path.win32.isAbsolute(relative)) {
    throw badRequest(`${label} 必须是相对路径：${relative}`)
  }
  if (relative.split(/[/\\]/).some((seg) => seg === '..')) {
    throw badRequest(`${label} 不允许包含 ..：${relative}`)
  }
}

/**
 * `blog/ai/xxx.md` → `<blogRoot>/content/blog/ai/xxx.md`
 *
 * 除了字符串层面的校验，最后还会用规范化后的绝对路径复核一次「确实落在 postsDir 里」，
 * 这样连符号链接和大小写差异都兜住了。
 */
export function resolvePostFile(ws: Workspace, file: string): string {
  assertSafeRelative(file, 'file')
  if (!file.startsWith(`${POSTS_PREFIX}/`)) {
    throw badRequest(`file 必须以 ${POSTS_PREFIX}/ 开头：${file}`)
  }
  if (!file.toLowerCase().endsWith('.md')) throw badRequest(`只能操作 .md 文件：${file}`)

  const absolute = path.resolve(ws.contentDir, file)
  if (!isInside(ws.postsDir, absolute)) throw badRequest(`file 超出文章目录：${file}`)
  return absolute
}

/** 图片名：只能是纯文件名，不能带目录 */
export function resolveImageFile(ws: Workspace, name: string): string {
  assertSafeRelative(name, 'name')
  if (name.includes('/') || name.includes('\\')) throw badRequest(`图片名不能带目录：${name}`)

  const absolute = path.resolve(ws.imagesDir, name)
  if (!isInside(ws.imagesDir, absolute)) throw badRequest(`图片名不合法：${name}`)
  return absolute
}

/** `child` 是否在 `parent` 里面（含 parent 自身） */
export function isInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

/** 系统路径 → POSIX 风格（Windows 上的 `\` 换成 `/`），对外一律用 `/` */
export function toPosix(p: string): string {
  return p.split(path.sep).join('/')
}
