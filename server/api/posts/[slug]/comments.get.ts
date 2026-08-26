export default defineEventHandler(async (event) => {
  noStore(event)

  const slug = requireSlug(event)
  const db = await useReadyDb()

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
