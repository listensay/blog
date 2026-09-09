import { createHash } from 'node:crypto'
import { readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { ImageItem, UnusedImages } from '../src/types.ts'
import { badRequest } from './http.ts'
import { type Workspace, ensureDir, resolveImageFile, toPosix } from './paths.ts'

const ALLOWED_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp', 'ico'])

export const PUBLIC_MOUNT = '/blog-public'

export const IMAGES_SITE_PREFIX = '/images'

export function imagePreviewUrl(name: string): string {
  return `${PUBLIC_MOUNT}${IMAGES_SITE_PREFIX}/${encodeURIComponent(name)}`
}

const sha256 = (buffer: Buffer): string => createHash('sha256').update(buffer).digest('hex')

export function sanitizeImageName(raw: string): string {
  const base = (raw.split(/[/\\]/).pop() ?? '').trim()
  const dot = base.lastIndexOf('.')
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : ''

  if (!ALLOWED_EXT.has(ext)) {
    throw badRequest(`不支持的图片格式「${ext || base}」，只接受 ${[...ALLOWED_EXT].join(' / ')}`)
  }

  const stem =
    base
      .slice(0, dot)
      .replace(/[\\/:*?"<>|]|\p{Cc}/gu, '')
      .replace(/\s+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(0, 80) || 'image'

  return `${stem}.${ext}`
}

async function readIfExists(absolute: string): Promise<Buffer | null> {
  try {
    return await readFile(absolute)
  } catch {
    return null
  }
}

export async function saveImage(
  ws: Workspace,
  rawName: string,
  data: Buffer,
): Promise<{ item: ImageItem; reused: boolean }> {
  if (!data.length) throw badRequest('图片内容是空的')

  const clean = sanitizeImageName(rawName)
  const dot = clean.lastIndexOf('.')
  const stem = clean.slice(0, dot)
  const ext = clean.slice(dot)
  const digest = sha256(data)

  ensureDir(ws.imagesDir)

  for (let n = 0; n < 1000; n += 1) {
    const name = n === 0 ? clean : `${stem}-${n}${ext}`
    const absolute = resolveImageFile(ws, name)
    const existing = await readIfExists(absolute)

    if (existing) {
      if (sha256(existing) === digest) {
        return { item: await toImageItem(ws, name), reused: true }
      }
      continue
    }

    await writeFile(absolute, data)
    return { item: await toImageItem(ws, name), reused: false }
  }

  throw badRequest(`${clean} 的同名文件过多，请更换名称`)
}

async function toImageItem(ws: Workspace, name: string): Promise<ImageItem> {
  const stats = await stat(resolveImageFile(ws, name))
  return { name, bytes: stats.size, mtime: stats.mtimeMs, previewUrl: imagePreviewUrl(name) }
}

export async function listImages(ws: Workspace): Promise<ImageItem[]> {
  let entries
  try {
    entries = await readdir(ws.imagesDir, { withFileTypes: true })
  } catch {
    return []
  }

  const items: ImageItem[] = []
  for (const entry of entries) {
    if (!entry.isFile() || entry.name.startsWith('.')) continue
    const ext = path.extname(entry.name).slice(1).toLowerCase()
    if (!ALLOWED_EXT.has(ext)) continue
    items.push(await toImageItem(ws, entry.name))
  }

  return items.sort((a, b) => b.mtime - a.mtime)
}

/** 扫描引用时读取的目录，相对 blog 根目录 */
export const SCAN_DIRS = ['content', 'app', 'server'] as const

/** 扫描引用时读取的单个文件，相对 blog 根目录 */
export const SCAN_FILES = ['nuxt.config.ts', 'content.config.ts'] as const

const SCAN_TEXT_EXT = new Set([
  '.md',
  '.json',
  '.ts',
  '.js',
  '.mjs',
  '.vue',
  '.css',
  '.yml',
  '.yaml',
])

const SCAN_SKIP_DIRS = new Set(['node_modules', 'dist', '.output', '.nuxt', '.git'])

const MAX_SCAN_BYTES = 4 * 1024 * 1024

interface ScannedFile {
  file: string
  text: string
}

async function collectTexts(dir: string, blogRoot: string, out: ScannedFile[]): Promise<void> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.') || SCAN_SKIP_DIRS.has(entry.name)) continue
    const absolute = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      await collectTexts(absolute, blogRoot, out)
      continue
    }
    if (!entry.isFile() || !SCAN_TEXT_EXT.has(path.extname(entry.name).toLowerCase())) continue

    await readTextFile(absolute, blogRoot, out)
  }
}

async function readTextFile(absolute: string, blogRoot: string, out: ScannedFile[]): Promise<void> {
  try {
    const stats = await stat(absolute)
    if (!stats.isFile() || stats.size > MAX_SCAN_BYTES) return
    out.push({
      file: toPosix(path.relative(blogRoot, absolute)),
      text: await readFile(absolute, 'utf8'),
    })
  } catch {
    /* 读不到的文件跳过，不影响其余扫描结果 */
  }
}

async function scanSources(ws: Workspace): Promise<ScannedFile[]> {
  const out: ScannedFile[] = []
  for (const dir of SCAN_DIRS) {
    await collectTexts(path.join(ws.blogRoot, dir), ws.blogRoot, out)
  }
  for (const file of SCAN_FILES) {
    await readTextFile(path.join(ws.blogRoot, file), ws.blogRoot, out)
  }
  return out
}

const REFERENCE_RE = new RegExp(
  String.raw`[^\s"'\`()<>\[\],;]+\.(?:${[...ALLOWED_EXT].join('|')})`,
  'gi',
)

/** 取路径最后一段，并把 %20 这类转义还原 */
function basenamesOf(token: string): string[] {
  const base = (token.split(/[/\\]/).pop() ?? '').toLowerCase()
  if (!base) return []

  try {
    const decoded = decodeURIComponent(base)
    return decoded === base ? [base] : [base, decoded]
  } catch {
    return [base]
  }
}

/**
 * 前一个字符属于文件名字符时不算命中，避免 `image.png` 被 `my-image.png` 的后半段匹配上。
 */
function mentions(haystack: string, token: string): boolean {
  for (let from = 0; ;) {
    const at = haystack.indexOf(token, from)
    if (at === -1) return false
    if (at === 0 || !/[A-Za-z0-9_.\-~%]/.test(haystack[at - 1]!)) return true
    from = at + 1
  }
}

/** 文件名可能被写成 `Pasted%20image.png`，逐字匹配前先补上这些等价写法 */
function variantsOf(name: string): string[] {
  const lower = name.toLowerCase()
  const encoded = new Set([lower])

  try {
    encoded.add(encodeURIComponent(name).toLowerCase())
  } catch {
    /* 名字里有孤立代理项时 encodeURIComponent 会抛，忽略即可 */
  }
  encoded.add(lower.replace(/ /g, '%20'))

  return [...encoded]
}

/**
 * 找出 public/images 里没有被任何内容或源码引用的图片。
 *
 * 两轮判定：先按扩展名摘出所有引用、取文件名建索引；索引里没有的再逐字搜一遍全文，
 * 兜住 `cover: .../Pasted image 2026.png` 这类带空格、摘不干净的写法。
 */
export async function findUnusedImages(ws: Workspace): Promise<UnusedImages> {
  const images = await listImages(ws)
  const sources = await scanSources(ws)

  const referenced = new Set<string>()
  for (const { text } of sources) {
    for (const [token] of text.matchAll(REFERENCE_RE)) {
      for (const base of basenamesOf(token)) referenced.add(base)
    }
  }

  const haystacks = sources.map((item) => item.text.toLowerCase())

  const unused = images.filter((image) => {
    if (referenced.has(image.name.toLowerCase())) return false
    const variants = variantsOf(image.name)
    return !haystacks.some((text) => variants.some((token) => mentions(text, token)))
  })

  return {
    images: unused,
    total: images.length,
    totalBytes: images.reduce((sum, item) => sum + item.bytes, 0),
    unusedBytes: unused.reduce((sum, item) => sum + item.bytes, 0),
    scanned: sources.length,
    roots: [...SCAN_DIRS, ...SCAN_FILES],
  }
}

/**
 * 删除图片。只接受当前判定为未被引用的文件名，任一名字不在其中则整批拒绝。
 */
export async function deleteUnusedImages(
  ws: Workspace,
  names: unknown,
): Promise<{ deleted: string[]; bytes: number; remaining: UnusedImages }> {
  if (!Array.isArray(names)) throw badRequest('names 应为数组')

  const wanted = names.map((name) => {
    if (typeof name !== 'string' || !name.trim()) throw badRequest('图片名不能为空')
    return name.trim()
  })
  if (!wanted.length) throw badRequest('没有选中任何图片')

  const scan = await findUnusedImages(ws)
  const removable = new Map(scan.images.map((item) => [item.name, item]))

  for (const name of wanted) {
    if (!removable.has(name)) throw badRequest(`${name} 正在被引用或不存在，未执行删除`)
  }

  let bytes = 0
  const deleted: string[] = []
  for (const name of new Set(wanted)) {
    await unlink(resolveImageFile(ws, name))
    bytes += removable.get(name)?.bytes ?? 0
    deleted.push(name)
  }

  return { deleted, bytes, remaining: await findUnusedImages(ws) }
}
