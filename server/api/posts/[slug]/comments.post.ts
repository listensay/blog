export default defineEventHandler(async (event) => {
  const slug = requireSlug(event)
  await assertPostExists(event, slug)

  const input = validateComment(await readBody(event) ?? {})
  const visitor = await visitorId(event)
  await assertNotFlooding(visitor)

  const db = await useReadyDb()

  if (input.parentId) {
    const parent = await db.sql`
      SELECT id FROM comments
      WHERE id = ${input.parentId} AND slug = ${slug} AND hidden = 0
    `
    if ((parent.rows ?? []).length === 0) {
      throw httpError(400, '要回复的评论不存在')
    }
  }

  const id = crypto.randomUUID()
  const now = Date.now()

  await db.sql`
    INSERT INTO comments (id, slug, parent_id, author, email_hash, website, body, visitor, hidden, created_at)
    VALUES (
      ${id}, ${slug}, ${input.parentId}, ${input.author}, ${await emailHash(input.email)},
      ${input.website || null}, ${input.body}, ${visitor}, 0, ${now}
    )
  `

  const result = await db.sql`
    SELECT id, slug, parent_id, author, email_hash, website, body, visitor, hidden, created_at
    FROM comments
    WHERE slug = ${slug} AND hidden = 0
    ORDER BY created_at ASC
    LIMIT 500
  `
  const rows = (result.rows ?? []) as unknown as CommentRow[]

  return {
    id,
    total: rows.length,
    comments: buildTree(rows),
  }
})
