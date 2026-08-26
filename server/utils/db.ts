const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS post_stats (slug TEXT PRIMARY KEY, views INTEGER NOT NULL DEFAULT 0, likes INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS visitor_views (slug TEXT NOT NULL, visitor TEXT NOT NULL, seen_at INTEGER NOT NULL, PRIMARY KEY (slug, visitor))`,
  `CREATE TABLE IF NOT EXISTS post_likes (slug TEXT NOT NULL, visitor TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (slug, visitor))`,
  `CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, slug TEXT NOT NULL, parent_id TEXT, author TEXT NOT NULL, email_hash TEXT, website TEXT, body TEXT NOT NULL, visitor TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_comments_slug ON comments (slug, hidden, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_comments_visitor ON comments (visitor, created_at)`,
]

let ready: Promise<void> | undefined

export function useDb() {
  const db = useDatabase()

  if (!ready) {
    ready = (async () => {
      for (const sql of SCHEMA) {
        await db.exec(sql)
      }
    })().catch((error) => {
      ready = undefined
      throw error
    })
  }

  return { db, ready }
}

export async function useReadyDb() {
  const { db, ready } = useDb()
  await ready
  return db
}
