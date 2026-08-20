/**
 * 点赞 / 取消点赞。toggle 语义：一个访客一篇文章只算一次，再点一次就撤回。
 * post_likes 的 (slug, visitor) 复合主键保证不会重复计数。
 */
export default defineEventHandler(async (event) => {
  const slug = requireSlug(event)
  await assertPostExists(event, slug)

  const db = await useReadyDb()
  const visitor = await visitorId(event)

  const existing = await db.sql`
    SELECT 1 AS ok FROM post_likes WHERE slug = ${slug} AND visitor = ${visitor}
  `
  const hadLiked = (existing.rows ?? []).length > 0

  if (hadLiked) {
    await db.sql`DELETE FROM post_likes WHERE slug = ${slug} AND visitor = ${visitor}`
    // 用 MAX(0, ...) 兜底，避免历史数据不一致时把计数写成负数
    await db.sql`
      UPDATE post_stats SET likes = MAX(0, likes - 1) WHERE slug = ${slug}
    `
  }
  else {
    await db.sql`
      INSERT INTO post_likes (slug, visitor, created_at) VALUES (${slug}, ${visitor}, ${Date.now()})
    `
    await db.sql`
      INSERT INTO post_stats (slug, views, likes) VALUES (${slug}, 0, 1)
      ON CONFLICT(slug) DO UPDATE SET likes = likes + 1
    `
  }

  const stats = await db.sql`SELECT views, likes FROM post_stats WHERE slug = ${slug}`
  const comments = await db.sql`SELECT COUNT(*) AS total FROM comments WHERE slug = ${slug} AND hidden = 0`
  const row = (stats.rows ?? [])[0] as { views: number, likes: number } | undefined
  const commentRow = (comments.rows ?? [])[0] as { total: number | string } | undefined

  return {
    views: row?.views ?? 0,
    likes: row?.likes ?? 0,
    comments: Number(commentRow?.total ?? 0),
    liked: !hadLiked,
  }
})
