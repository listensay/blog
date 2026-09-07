export interface CommentRow {
  id: string
  slug: string
  parent_id: string | null
  author: string
  email_hash: string | null
  website: string | null
  body: string
  visitor: string
  hidden: number
  created_at: number
}

export interface PublicComment {
  id: string
  author: string
  website: string | null
  body: string
  createdAt: number
  hue: number
  replyTo: string | null
  replies: PublicComment[]
}

function hueOf(row: CommentRow) {
  const seed = row.email_hash || row.author
  let hue = 0
  for (let i = 0; i < seed.length; i++) {
    hue = (hue * 31 + seed.charCodeAt(i)) % 360
  }
  return hue
}

function toPublic(row: CommentRow, replyTo: string | null): PublicComment {
  return {
    id: row.id,
    author: row.author,
    website: row.website || null,
    body: row.body,
    createdAt: row.created_at,
    hue: hueOf(row),
    replyTo,
    replies: [],
  }
}

export function buildTree(rows: CommentRow[]): PublicComment[] {
  const byId = new Map(rows.map(row => [row.id, row]))
  const roots: PublicComment[] = []
  const nodes = new Map<string, PublicComment>()

  function rootOf(row: CommentRow): CommentRow | undefined {
    let current = row
    for (let step = 0; step < 32; step++) {
      if (!current.parent_id) return current
      const parent = byId.get(current.parent_id)
      if (!parent) return undefined
      current = parent
    }
    return undefined
  }

  for (const row of rows) {
    const parent = row.parent_id ? byId.get(row.parent_id) : undefined
    const root = row.parent_id ? rootOf(row) : row

    if (!root || root.id === row.id) {
      const node = toPublic(row, null)
      nodes.set(row.id, node)
      roots.push(node)
      continue
    }

    const node = toPublic(row, parent?.author ?? null)
    nodes.set(row.id, node)
    nodes.get(root.id)?.replies.push(node)
  }

  return roots
}

export interface CommentListResult {
  total: number
  comments: PublicComment[]
}

export async function listComments(target: string): Promise<CommentListResult> {
  const db = await useReadyDb()

  const result = await db.sql`
    SELECT id, slug, parent_id, author, email_hash, website, body, visitor, hidden, created_at
    FROM comments
    WHERE slug = ${target} AND hidden = 0
    ORDER BY created_at ASC
    LIMIT 500
  `
  const rows = (result.rows ?? []) as unknown as CommentRow[]

  return { total: rows.length, comments: buildTree(rows) }
}

export async function createComment(
  target: string,
  input: CommentInput,
  visitor: string,
): Promise<CommentListResult & { id: string }> {
  const db = await useReadyDb()

  if (input.parentId) {
    const parent = await db.sql`
      SELECT id FROM comments
      WHERE id = ${input.parentId} AND slug = ${target} AND hidden = 0
    `
    if ((parent.rows ?? []).length === 0) {
      throw httpError(400, '要回复的评论不存在')
    }
  }

  const id = crypto.randomUUID()

  await db.sql`
    INSERT INTO comments (id, slug, parent_id, author, email_hash, website, body, visitor, hidden, created_at)
    VALUES (
      ${id}, ${target}, ${input.parentId}, ${input.author}, ${await emailHash(input.email)},
      ${input.website || null}, ${input.body}, ${visitor}, 0, ${Date.now()}
    )
  `

  return { id, ...(await listComments(target)) }
}
