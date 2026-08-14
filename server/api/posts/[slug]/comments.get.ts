/** 一篇文章的公开评论，按时间升序，前端自己组织成两层 */
export default defineEventHandler(async (event) => {
  noStore(event)

  const slug = requireSlug(event)
  const db = await useReadyDb()

  // hidden = 0：被管理员删掉的是软删除，读接口一律看不到
  const result = await db.sql`
    SELECT id, slug, parent_id, author, email_hash, website, body, visitor, hidden, created_at
    FROM comments
    WHERE slug = ${slug} AND hidden = 0
    ORDER BY created_at ASC
    LIMIT 500
  `
  const rows = (result.rows ?? []) as unknown as CommentRow[]

  return {
    total: rows.length,
    comments: buildTree(rows),
  }
})
