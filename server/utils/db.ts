/**
 * 建表语句。
 *
 * 每条必须写成单行——D1 的 exec() 按换行符切分语句，多行 SQL 会被切碎报错。
 * better-sqlite3 没这个限制，但为了两端同一份代码，统一按 D1 的规矩写。
 *
 * 表名刻意避开 _content_ 前缀：@nuxt/content 每次校验 checksum 不匹配时会
 * DROP 掉它自己的 _content_* 表重建，这几张表不在它的管辖范围内，不会被清掉。
 */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS post_stats (slug TEXT PRIMARY KEY, views INTEGER NOT NULL DEFAULT 0, likes INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS visitor_views (slug TEXT NOT NULL, visitor TEXT NOT NULL, seen_at INTEGER NOT NULL, PRIMARY KEY (slug, visitor))`,
  `CREATE TABLE IF NOT EXISTS post_likes (slug TEXT NOT NULL, visitor TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (slug, visitor))`,
  `CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, slug TEXT NOT NULL, parent_id TEXT, author TEXT NOT NULL, email_hash TEXT, website TEXT, body TEXT NOT NULL, visitor TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_comments_slug ON comments (slug, hidden, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_comments_visitor ON comments (visitor, created_at)`,
]

// 每个 isolate 只建一次表。失败要把缓存清掉，否则一次冷启动抖动会永久卡住这个实例。
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

/** 大部分接口只关心「表已就绪的 db」，这个包装省掉每处都解构 */
export async function useReadyDb() {
  const { db, ready } = useDb()
  await ready
  return db
}
