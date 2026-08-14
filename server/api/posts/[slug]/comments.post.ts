/** 提交评论。审核策略是「先发后审」，所以校验和限流都压在这一步 */
export default defineEventHandler(async (event) => {
  const slug = requireSlug(event)
  await assertPostExists(event, slug)

  const input = validateComment(await readBody(event) ?? {})
  const visitor = await visitorId(event)
  await assertNotFlooding(visitor)

  const db = await useReadyDb()

  // 回复必须指向同一篇文章下、还没被删的评论，避免跨文章挂楼
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

  // 回传整棵树，前端直接换掉列表，省一次请求也不用自己插节点
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
