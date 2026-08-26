export default defineEventHandler(async (event) => {
  noStore(event)
  await requireAdmin(event)

  const query = getQuery(event)
  const status = String(query.status ?? 'all')
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200)
  const offset = Math.max(Number(query.offset) || 0, 0)

  const db = await useReadyDb()

  const hiddenFilter = status === 'visible' ? 0 : status === 'hidden' ? 1 : -1

  const result = await db.sql`
    SELECT id, slug, parent_id, author, website, body, visitor, hidden, created_at
    FROM comments
    WHERE (${hiddenFilter} = -1 OR hidden = ${hiddenFilter})
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  const counts = await db.sql`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN hidden = 0 THEN 1 ELSE 0 END) AS visible,
      SUM(CASE WHEN hidden = 1 THEN 1 ELSE 0 END) AS hidden
    FROM comments
  `
  const summary = (counts.rows ?? [])[0] as { total: number, visible: number, hidden: number } | undefined

  const rows = (result.rows ?? []) as unknown as Array<{
    id: string
    slug: string
    parent_id: string | null
    author: string
    website: string | null
    body: string
    visitor: string
    hidden: number
    created_at: number
  }>

  return {
    summary: {
      total: summary?.total ?? 0,
      visible: summary?.visible ?? 0,
      hidden: summary?.hidden ?? 0,
    },
    comments: rows.map(row => ({
      id: row.id,
      slug: row.slug,
      parentId: row.parent_id,
      author: row.author,
      website: row.website || null,
      body: row.body,
      hidden: Boolean(row.hidden),
      createdAt: row.created_at,
      visitor: row.visitor.slice(0, 8),
    })),
  }
})
