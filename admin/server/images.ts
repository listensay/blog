import { createHash } from 'node:crypto'
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { ImageItem } from '../src/types.ts'
import { badRequest } from './http.ts'
import { type Workspace, ensureDir, resolveImageFile } from './paths.ts'

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

  throw badRequest(`${clean} 的同名文件太多了，换个名字`)
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
