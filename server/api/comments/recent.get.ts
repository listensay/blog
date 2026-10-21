import { queryCollection } from '@nuxt/content/server'
import type { CommentRow } from '../../utils/comments'

export default defineEventHandler(async (event) => {
  noStore(event)
  const [posts, pages, db] = await Promise.all([
    queryCollection(event, 'blog').where('draft', '=', false).select('slug', 'path', 'title').all(),
    queryCollection(event, 'pages').where('comments', '=', true).select('path', 'title').all(),
    useReadyDb(),
  ])
  const targets = new Map<string, { path: string, title: string }>()
  for (const post of posts) targets.set(post.slug, { path: post.path, title: post.title })
  for (const page of pages) targets.set(pageTargetId(pathToPageName(page.path)), { path: page.path, title: page.title })

  // db.sql treats statements starting with WITH as writes; read their rows explicitly.
  const result = await db.prepare(`
    WITH RECURSIVE visible_comments(id) AS (
      SELECT id FROM comments WHERE hidden = 0 AND parent_id IS NULL
      UNION ALL
      SELECT c.id FROM comments c
      INNER JOIN visible_comments parent ON c.parent_id = parent.id
      WHERE c.hidden = 0
    )
    SELECT id, slug, author, email_hash, body
    FROM comments
    WHERE id IN (SELECT id FROM visible_comments)
    ORDER BY created_at DESC, id DESC
    LIMIT 100
  `).all()
  const rows = result as unknown as Pick<CommentRow, 'id' | 'slug' | 'author' | 'email_hash' | 'body'>[]
  return rows.filter(row => targets.has(row.slug)).slice(0, 6).map((row) => {
    let hue = 0
    for (const char of row.email_hash || row.author) hue = (hue * 31 + char.charCodeAt(0)) % 360
    return {
      id: row.id,
      author: row.author,
      body: row.body,
      hue,
      ...targets.get(row.slug)!,
    }
  })
})
