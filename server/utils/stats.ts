const VIEW_WINDOW_MS = 24 * 3600_000

export interface StatsSnapshot {
  views: number
  likes: number
  comments: number
  liked: boolean
}

export async function readStats(target: string, visitor: string): Promise<StatsSnapshot> {
  const db = await useReadyDb()

  const stats = await db.sql`SELECT views, likes FROM post_stats WHERE slug = ${target}`
  const liked = await db.sql`SELECT 1 AS ok FROM post_likes WHERE slug = ${target} AND visitor = ${visitor}`
  const comments = await db.sql`SELECT COUNT(*) AS total FROM comments WHERE slug = ${target} AND hidden = 0`

  const row = (stats.rows ?? [])[0] as { views: number, likes: number } | undefined
  const commentRow = (comments.rows ?? [])[0] as { total: number | string } | undefined

  return {
    views: row?.views ?? 0,
    likes: row?.likes ?? 0,
    comments: Number(commentRow?.total ?? 0),
    liked: (liked.rows ?? []).length > 0,
  }
}

export async function toggleLike(target: string, visitor: string): Promise<StatsSnapshot> {
  const db = await useReadyDb()

  const existing = await db.sql`
    SELECT 1 AS ok FROM post_likes WHERE slug = ${target} AND visitor = ${visitor}
  `

  if ((existing.rows ?? []).length > 0) {
    await db.sql`DELETE FROM post_likes WHERE slug = ${target} AND visitor = ${visitor}`
    await db.sql`UPDATE post_stats SET likes = MAX(0, likes - 1) WHERE slug = ${target}`
  }
  else {
    await db.sql`
      INSERT INTO post_likes (slug, visitor, created_at) VALUES (${target}, ${visitor}, ${Date.now()})
    `
    await db.sql`
      INSERT INTO post_stats (slug, views, likes) VALUES (${target}, 0, 1)
      ON CONFLICT(slug) DO UPDATE SET likes = likes + 1
    `
  }

  return readStats(target, visitor)
}

export async function countView(
  target: string,
  visitor: string,
): Promise<StatsSnapshot & { counted: boolean }> {
  const db = await useReadyDb()
  const now = Date.now()

  const seen = await db.sql`
    SELECT seen_at FROM visitor_views WHERE slug = ${target} AND visitor = ${visitor}
  `
  const last = ((seen.rows ?? [])[0] as { seen_at: number } | undefined)?.seen_at
  const counted = last === undefined || last < now - VIEW_WINDOW_MS

  if (counted) {
    if (last === undefined) {
      await db.sql`INSERT INTO visitor_views (slug, visitor, seen_at) VALUES (${target}, ${visitor}, ${now})`
    }
    else {
      await db.sql`UPDATE visitor_views SET seen_at = ${now} WHERE slug = ${target} AND visitor = ${visitor}`
    }

    await db.sql`
      INSERT INTO post_stats (slug, views, likes) VALUES (${target}, 1, 0)
      ON CONFLICT(slug) DO UPDATE SET views = views + 1
    `
  }

  return { ...(await readStats(target, visitor)), counted }
}
