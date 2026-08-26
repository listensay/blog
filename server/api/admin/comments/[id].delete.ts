export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = requireCommentId(event)
  const purge = String(getQuery(event).purge ?? '') === '1'
  const db = await useReadyDb()

  const found = await db.sql`SELECT id FROM comments WHERE id = ${id}`
  if ((found.rows ?? []).length === 0) {
    throw httpError(404, '评论不存在')
  }

  if (purge) {
    await db.sql`DELETE FROM comments WHERE id = ${id} OR parent_id = ${id}`
  }
  else {
    await db.sql`UPDATE comments SET hidden = 1 WHERE id = ${id}`
  }

  return { ok: true, purged: purge }
})
