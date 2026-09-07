import type { H3Event } from 'h3'
import { queryCollection } from '@nuxt/content/server'

interface Row {
  id: string
  slug: string
  parent_id: string | null
  author: string
  website: string | null
  body: string
  visitor: string
  hidden: number
  created_at: number
}

// 评论表里存的是目标标识，不是站内地址。文章的地址由 slug-path transformer 决定
// （可能带目录，如 /blog/ai/free-ai），页面的地址是 /<文件名>。
// 来源已删除时该条没有地址。
async function resolvePaths(event: H3Event, targets: string[]) {
  const paths = new Map<string, string>()
  const slugs: string[] = []
  const pagePaths: string[] = []

  for (const target of new Set(targets)) {
    const name = pageNameOf(target)
    if (name === null) slugs.push(target)
    else pagePaths.push(`/${name}`)
  }

  if (slugs.length) {
    const posts = await queryCollection(event, 'blog')
      .where('slug', 'IN', slugs)
      .select('slug', 'path')
      .all()
    for (const post of posts) {
      if (post.slug) paths.set(post.slug, post.path)
    }
  }

  if (pagePaths.length) {
    const pages = await queryCollection(event, 'pages')
      .where('path', 'IN', pagePaths)
      .select('path')
      .all()
    for (const page of pages) {
      paths.set(pageTargetId(pathToPageName(page.path)), page.path)
    }
  }

  return paths
}

export default defineEventHandler(async (event) => {
  noStore(event)
  await requireAdmin(event)

  const query = getQuery(event)
  const status = String(query.status ?? 'all')
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200)
  const offset = Math.max(Number(query.offset) || 0, 0)

  const db = await useReadyDb()

  const hiddenFilter = status === 'visible' ? 0 : status === 'hidden' ? 1 : -1

  const result = await db.sql`
    SELECT id, slug, parent_id, author, website, body, visitor, hidden, created_at
    FROM comments
    WHERE (${hiddenFilter} = -1 OR hidden = ${hiddenFilter})
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  const counts = await db.sql`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN hidden = 0 THEN 1 ELSE 0 END) AS visible,
      SUM(CASE WHEN hidden = 1 THEN 1 ELSE 0 END) AS hidden
    FROM comments
  `
  const summary = (counts.rows ?? [])[0] as { total: number, visible: number, hidden: number } | undefined

  const rows = (result.rows ?? []) as unknown as Row[]
  const paths = await resolvePaths(event, rows.map(row => row.slug))

  return {
    summary: {
      total: summary?.total ?? 0,
      visible: summary?.visible ?? 0,
      hidden: summary?.hidden ?? 0,
    },
    comments: rows.map(row => ({
      id: row.id,
      target: row.slug,
      kind: pageNameOf(row.slug) === null ? ('post' as const) : ('page' as const),
      path: paths.get(row.slug) ?? null,
      parentId: row.parent_id,
      author: row.author,
      website: row.website || null,
      body: row.body,
      hidden: Boolean(row.hidden),
      createdAt: row.created_at,
      visitor: row.visitor.slice(0, 8),
    })),
  }
})
