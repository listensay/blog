import type { H3Event } from 'h3'

export const COMMENT_LIMITS = {
  author: 24,
  email: 120,
  website: 200,
  body: 1000,
  /** 正文里最多允许几个链接 */
  links: 2,
  /** 两条评论之间的最小间隔 */
  cooldownMs: 30_000,
  /** 一小时内同一访客最多几条 */
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

/**
 * 评论提交后直接可见，所以校验必须在这一步拦住绝大部分垃圾。
 * 三道防线：蜜罐字段、字段合法性、频率限制。
 */
export function validateComment(raw: Record<string, unknown>): CommentInput {
  // 蜜罐：真人看不到 homepage 这个输入框，脚本会无脑填满所有 input。
  // 刻意不叫 nickname/url 之类的名字——那些在浏览器自动填充的白名单里，会误伤真人。
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

/** 同一访客的发言频率限制，直接查 comments 表，不用额外的计数表 */
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

/** slug 只允许出现在 URL 里的安全字符，顺手挡掉注入和越界查询 */
export function requireSlug(event: H3Event) {
  const slug = String(getRouterParam(event, 'slug') ?? '').trim()
  if (!slug || slug.length > 120 || !/^[\w-]+$/.test(slug)) {
    throw httpError(400, '文章标识不合法')
  }
  return slug
}

/** 评论 ID 只接受 crypto.randomUUID() 的形状 */
export function requireCommentId(event: H3Event) {
  const id = String(getRouterParam(event, 'id') ?? '')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw httpError(400, '评论 ID 不合法')
  }
  return id
}
