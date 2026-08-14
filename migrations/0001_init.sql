-- 初始化业务表。自动建表已经在 server/utils/db.ts 里做了，
-- 这个文件用于想手动初始化或排查时执行：
--   npx wrangler d1 execute blog-content --remote --file migrations/0001_init.sql
--
-- 注意：这些表不带 _content_ 前缀，@nuxt/content 重建内容索引时不会碰它们。

CREATE TABLE IF NOT EXISTS post_stats (slug TEXT PRIMARY KEY, views INTEGER NOT NULL DEFAULT 0, likes INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS visitor_views (slug TEXT NOT NULL, visitor TEXT NOT NULL, seen_at INTEGER NOT NULL, PRIMARY KEY (slug, visitor));
CREATE TABLE IF NOT EXISTS post_likes (slug TEXT NOT NULL, visitor TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (slug, visitor));
CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, slug TEXT NOT NULL, parent_id TEXT, author TEXT NOT NULL, email_hash TEXT, website TEXT, body TEXT NOT NULL, visitor TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_comments_slug ON comments (slug, hidden, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_visitor ON comments (visitor, created_at);
