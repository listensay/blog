const WINDOW_MS = 24 * 3600_000

/**
 * 记一次浏览。同一访客同一篇文章 24 小时内只计一次，
 * 靠 visitor_views 的 (slug, visitor) 复合主键去重。
 *
 * 由前端在挂载后调用，而不是在 SSR 里计数——否则爬虫和预取请求都会被算进去。
 */
export default defineEventHandler(async (event) => {
  const slug = requireSlug(event)
  await assertPostExists(event, slug)

  const db = await useReadyDb()
  const visitor = await visitorId(event)
  const now = Date.now()

  const seen = await db.sql`
    SELECT seen_at FROM visitor_views WHERE slug = ${slug} AND visitor = ${visitor}
  `
  const last = ((seen.rows ?? [])[0] as { seen_at: number } | undefined)?.seen_at

  const isNewView = last === undefined || last < now - WINDOW_MS

  if (isNewView) {
    if (last === undefined) {
      await db.sql`INSERT INTO visitor_views (slug, visitor, seen_at) VALUES (${slug}, ${visitor}, ${now})`
    }
    else {
      await db.sql`UPDATE visitor_views SET seen_at = ${now} WHERE slug = ${slug} AND visitor = ${visitor}`
    }

    await db.sql`
      INSERT INTO post_stats (slug, views, likes) VALUES (${slug}, 1, 0)
      ON CONFLICT(slug) DO UPDATE SET views = views + 1
    `
  }

  const stats = await db.sql`SELECT views, likes FROM post_stats WHERE slug = ${slug}`
  const liked = await db.sql`SELECT 1 AS ok FROM post_likes WHERE slug = ${slug} AND visitor = ${visitor}`
  const comments = await db.sql`SELECT COUNT(*) AS total FROM comments WHERE slug = ${slug} AND hidden = 0`
  const row = (stats.rows ?? [])[0] as { views: number, likes: number } | undefined
  const commentRow = (comments.rows ?? [])[0] as { total: number | string } | undefined

  return {
    views: row?.views ?? 0,
    likes: row?.likes ?? 0,
    comments: Number(commentRow?.total ?? 0),
    liked: ((liked.rows ?? []).length > 0),
    counted: isNewView,
  }
})
