import type { H3Event } from 'h3'

export const COMMENT_LIMITS = {
  author: 24,
  email: 120,
  website: 200,
  body: 1000,
  links: 2,
  cooldownMs: 30_000,
  perHour: 8,
}

export interface CommentInput {
  author: string
  email: string
  website: string
  body: string
  parentId: string | null
}

function fail(message: string): never {
  throw httpError(400, message)
}

export function validateComment(raw: Record<string, unknown>): CommentInput {
  if (typeof raw.homepage === 'string' && raw.homepage.trim()) {
    fail('提交被拒绝')
  }

  const author = String(raw.author ?? '').trim()
  const email = String(raw.email ?? '').trim()
  const website = String(raw.website ?? '').trim()
  const body = String(raw.body ?? '').trim()
  const parentId = raw.parentId ? String(raw.parentId).trim() : null

  if (!author) fail('请填写昵称')
  if ([...author].length > COMMENT_LIMITS.author) fail(`昵称不能超过 ${COMMENT_LIMITS.author} 个字`)

  if (!body) fail('请填写评论内容')
  if ([...body].length > COMMENT_LIMITS.body) fail(`评论不能超过 ${COMMENT_LIMITS.body} 个字`)

  if (email) {
    if (email.length > COMMENT_LIMITS.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fail('邮箱格式不对')
    }
  }

  if (website) {
    if (website.length > COMMENT_LIMITS.website || !/^https?:\/\/[^\s]+$/.test(website)) {
      fail('网址要以 http:// 或 https:// 开头')
    }
  }

  const linkCount = (body.match(/https?:\/\//gi) || []).length
  if (linkCount > COMMENT_LIMITS.links) {
    fail(`正文里的链接不能超过 ${COMMENT_LIMITS.links} 个`)
  }

  return { author, email, website, body, parentId }
}

export async function assertNotFlooding(visitor: string) {
  const db = await useReadyDb()
  const now = Date.now()

  const recent = await db.sql`
    SELECT created_at FROM comments
    WHERE visitor = ${visitor} AND created_at > ${now - 3_600_000}
    ORDER BY created_at DESC
  `
  const rows = (recent.rows ?? []) as { created_at: number }[]

  if (rows.length >= COMMENT_LIMITS.perHour) {
    throw httpError(429, '发言太频繁，过一会儿再来')
  }

  const last = rows[0]?.created_at ?? 0
  if (now - last < COMMENT_LIMITS.cooldownMs) {
    const wait = Math.ceil((COMMENT_LIMITS.cooldownMs - (now - last)) / 1000)
    throw httpError(429, `请等 ${wait} 秒再发`)
  }
}

export function requireSlug(event: H3Event) {
  const slug = String(getRouterParam(event, 'slug') ?? '').trim()
  if (!slug || slug.length > 120 || !/^[\w-]+$/.test(slug)) {
    throw httpError(400, '文章标识不合法')
  }
  return slug
}

export function requireCommentId(event: H3Event) {
  const id = String(getRouterParam(event, 'id') ?? '')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw httpError(400, '评论 ID 不合法')
  }
  return id
}
