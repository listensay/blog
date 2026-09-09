import type { DashboardStats, RecentItem, TodoGroup, TodoItem, TrendPoint } from '../src/types.ts'
import { findUnusedImages } from './images.ts'
import { listPages } from './pages.ts'
import { listPosts } from './posts.ts'
import type { Workspace } from './paths.ts'

/** 趋势图的月份数 */
const TREND_MONTHS = 12

/** 每组待办最多回传的条目数，count 仍是完整数量 */
const TODO_SAMPLE = 6

/** 最近修改列表的条目数 */
const RECENT_LIMIT = 8

const pad = (n: number) => String(n).padStart(2, '0')

function monthKeys(now: Date): string[] {
  const keys: string[] = []
  for (let back = TREND_MONTHS - 1; back >= 0; back -= 1) {
    const at = new Date(now.getFullYear(), now.getMonth() - back, 1)
    keys.push(`${at.getFullYear()}-${pad(at.getMonth() + 1)}`)
  }
  return keys
}

function buildTrend(dates: string[], now = new Date()): TrendPoint[] {
  const buckets = new Map<string, number>(monthKeys(now).map((key) => [key, 0]))

  for (const date of dates) {
    const key = date.slice(0, 7)
    const current = buckets.get(key)
    if (current !== undefined) buckets.set(key, current + 1)
  }

  return [...buckets].map(([month, count]) => ({ month, count }))
}

function group(key: TodoGroup['key'], label: string, items: TodoItem[]): TodoGroup | null {
  if (!items.length) return null
  return { key, label, count: items.length, items: items.slice(0, TODO_SAMPLE) }
}

export async function readDashboard(ws: Workspace): Promise<DashboardStats> {
  const [{ posts, categories, tags }, { pages }, images] = await Promise.all([
    listPosts(ws),
    listPages(ws),
    findUnusedImages(ws),
  ])

  const drafts = posts.filter((post) => post.draft)

  const recent: RecentItem[] = [
    ...posts.map((post) => ({
      kind: 'post' as const,
      title: post.title || post.name,
      file: post.file,
      mtime: post.mtime,
      draft: post.draft,
    })),
    ...pages.map((page) => ({
      kind: 'page' as const,
      title: page.title || page.name,
      file: page.file,
      mtime: page.mtime,
      draft: false,
    })),
  ]
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, RECENT_LIMIT)

  const asPost = (title: string, file: string): TodoItem => ({ kind: 'post', title, file })

  const todos = [
    group(
      'draft',
      '草稿未发布',
      drafts.map((post) => asPost(post.title || post.name, post.file)),
    ),
    group(
      'path-mismatch',
      'frontmatter 的 path 与 slug 算出的地址不一致',
      posts
        .filter((post) => post.path && post.realPath && post.path !== post.realPath)
        .map((post) => asPost(post.title || post.name, post.file)),
    ),
    group('no-description', '缺 description', [
      ...posts
        .filter((post) => !post.description)
        .map((post) => asPost(post.title || post.name, post.file)),
      ...pages
        .filter((page) => !page.description)
        .map((page) => ({
          kind: 'page' as const,
          title: page.title || page.name,
          file: page.file,
        })),
    ]),
    group(
      'no-cover',
      '缺封面',
      posts.filter((post) => !post.cover).map((post) => asPost(post.title || post.name, post.file)),
    ),
    group(
      'no-category',
      '缺分类',
      posts
        .filter((post) => !post.category)
        .map((post) => asPost(post.title || post.name, post.file)),
    ),
  ].filter((item): item is TodoGroup => item !== null)

  return {
    counts: {
      posts: posts.length,
      published: posts.length - drafts.length,
      drafts: drafts.length,
      pages: pages.length,
      categories: categories.length,
      tags: tags.length,
      images: images.total,
      imageBytes: images.totalBytes,
      unusedImages: images.images.length,
      unusedBytes: images.unusedBytes,
    },
    trend: buildTrend(posts.map((post) => post.date)),
    recent,
    todos,
  }
}
