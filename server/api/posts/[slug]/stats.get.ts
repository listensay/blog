export default defineEventHandler(async (event) => {
  noStore(event)

  const slug = requireSlug(event)
  const db = await useReadyDb()
  const visitor = await visitorId(event)

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
  }
})
