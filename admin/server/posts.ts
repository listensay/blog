import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'

import type { PostListResponse, PostSummary } from '../src/types.ts'
import { countBodyImages, normalizeFrontmatter, splitFrontmatter } from './frontmatter.ts'
import { POSTS_PREFIX, type Workspace, toPosix } from './paths.ts'
async function walkMarkdown(dir: string, base = ''): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const rel = base ? `${base}/${entry.name}` : entry.name

    if (entry.isDirectory()) {
      files.push(...(await walkMarkdown(path.join(dir, entry.name), rel)))
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(rel)
    }
  }

  return files.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
}

function computeRealPath(dir: string, slug: string): string {
  if (!slug) return ''
  const segments = [POSTS_PREFIX, ...(dir ? dir.split('/') : []), slug]
  return `/${segments.join('/')}`
}

async function toSummary(ws: Workspace, relative: string): Promise<PostSummary> {
  const absolute = path.join(ws.postsDir, relative)
  const [raw, stats] = await Promise.all([readFile(absolute, 'utf8'), stat(absolute)])

  const { data, body } = splitFrontmatter(raw)
  const fm = normalizeFrontmatter(data)

  const posix = toPosix(relative)
  const lastSlash = posix.lastIndexOf('/')
  const dir = lastSlash === -1 ? '' : posix.slice(0, lastSlash)
  const filename = lastSlash === -1 ? posix : posix.slice(lastSlash + 1)

  return {
    ...fm,
    file: `${POSTS_PREFIX}/${posix}`,
    dir,
    name: filename.replace(/\.md$/i, ''),
    realPath: computeRealPath(dir, fm.slug),
    mtime: stats.mtimeMs,
    bytes: stats.size,
    images: countBodyImages(body),
  }
}

export async function listPosts(ws: Workspace): Promise<PostListResponse> {
  const files = await walkMarkdown(ws.postsDir)
  const posts = await Promise.all(files.map((file) => toSummary(ws, file)))

  posts.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.mtime - a.mtime)

  const categories = new Set<string>()
  const tags = new Set<string>()
  const dirs = new Set<string>()
  for (const post of posts) {
    if (post.category) categories.add(post.category)
    for (const tag of post.tags) tags.add(tag)
    if (post.dir) dirs.add(post.dir)
  }

  for (const entry of await readdir(ws.postsDir, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) dirs.add(entry.name)
  }

  const byZh = (a: string, b: string) => a.localeCompare(b, 'zh-Hans-CN')
  return {
    posts,
    categories: [...categories].sort(byZh),
    tags: [...tags].sort(byZh),
    dirs: [...dirs].sort(byZh),
  }
}
