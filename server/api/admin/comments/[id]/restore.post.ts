/** 恢复被软删的评论：hidden = 0 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = requireCommentId(event)
  const db = await useReadyDb()

  const found = await db.sql`SELECT id FROM comments WHERE id = ${id}`
  if ((found.rows ?? []).length === 0) {
    throw httpError(404, '评论不存在')
  }

  await db.sql`UPDATE comments SET hidden = 0 WHERE id = ${id}`

  return { ok: true }
})
