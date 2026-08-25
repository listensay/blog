// 定位 blog 仓库里的几个目录，把「相对 content/ 的路径」安全还原成绝对路径
// 只允许碰 content/、public/images/、admin/.trash/，其余一律拒绝，免得 `?file=../../.env` 读到仓库外
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
  /** `<blogRoot>/content/pages`，固定页都在这下面 */
  pagesDir: string
  /** `<blogRoot>/content/data/nav.json`，顶部菜单 */
  navFile: string
  /** `<blogRoot>/public` */
  publicDir: string
  /** `<blogRoot>/public/images` */
  imagesDir: string
  /** `<adminRoot>/.trash` */
  trashDir: string
}

/** 文章路径的集合前缀。`file` 一律形如 `blog/ai/xxx.md` */
export const POSTS_PREFIX = 'blog'

/** 固定页路径的集合前缀。`file` 一律形如 `pages/about.md` */
export const PAGES_PREFIX = 'pages'

// 解析工作区。`adminRoot` 传 Vite 的 config.root，blog 根默认取它的上一级
// `ADMIN_BLOG_ROOT` 可以覆盖：验证脚本靠它指到临时副本，不然测试会写进真仓库
export function resolveWorkspace(adminRoot: string): Workspace {
  const fromEnv = process.env.ADMIN_BLOG_ROOT?.trim()
  const blogRoot = fromEnv ? path.resolve(adminRoot, fromEnv) : path.resolve(adminRoot, '..')

  const ws: Workspace = {
    blogRoot,
    contentDir: path.join(blogRoot, 'content'),
    postsDir: path.join(blogRoot, 'content', 'blog'),
    pagesDir: path.join(blogRoot, 'content', 'pages'),
    navFile: path.join(blogRoot, 'content', 'data', 'nav.json'),
    publicDir: path.join(blogRoot, 'public'),
    imagesDir: path.join(blogRoot, 'public', 'images'),
    trashDir: path.join(adminRoot, '.trash'),
  }

  // 目录不对就直接说清楚是哪个，别等到第一次请求才报 ENOENT。
  // 不检查 pages/ 和 data/：那两个是「有就管、没有就现建」的
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

// `blog/ai/xxx.md` → `<blogRoot>/content/blog/ai/xxx.md`
// 先按字符串挡掉 `..`、绝对路径、NUL，再用绝对路径复核确实落在 postsDir 里（不解析符号链接）
export function resolvePostFile(ws: Workspace, file: string): string {
  return resolveContentFile(ws.postsDir, ws.contentDir, file, POSTS_PREFIX, '文章目录')
}

/** `pages/about.md` → `<blogRoot>/content/pages/about.md`，同上 */
export function resolvePageFile(ws: Workspace, file: string): string {
  return resolveContentFile(ws.pagesDir, ws.contentDir, file, PAGES_PREFIX, '页面目录')
}

/** 文章和页面共用一套解析，区别只有该落在哪个子目录里 —— 校验只留一份 */
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
