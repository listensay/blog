import type { H3Event } from 'h3'

const COOKIE = 'blog_admin'
const SESSION_MS = 7 * 24 * 3600_000

function config(event: H3Event) {
  const { adminPassword, sessionSecret } = useRuntimeConfig(event)

  // 没配密钥就整体关闭后台，绝不退化成「空密码可进」
  if (!adminPassword || !sessionSecret) {
    throw httpError(503, '后台未启用：请先设置 NUXT_ADMIN_PASSWORD 和 NUXT_SESSION_SECRET')
  }

  return { adminPassword, sessionSecret }
}

/** 给管理页用：密钥没配好时直接告诉用户原因，而不是让他反复试密码 */
export function adminEnabled(event: H3Event) {
  const { adminPassword, sessionSecret } = useRuntimeConfig(event)
  return Boolean(adminPassword && sessionSecret)
}

export async function signIn(event: H3Event, password: string) {
  const { adminPassword, sessionSecret } = config(event)

  if (!safeEqual(password, adminPassword)) {
    // 故意慢一点，压低在线爆破的速率
    await new Promise(resolve => setTimeout(resolve, 400))
    throw httpError(401, '密码不对')
  }

  const expires = Date.now() + SESSION_MS
  const token = `${expires}.${await hmacHex(sessionSecret, String(expires))}`

  setCookie(event, COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: !import.meta.dev,
    path: '/',
    maxAge: SESSION_MS / 1000,
  })
}

export function signOut(event: H3Event) {
  deleteCookie(event, COOKIE, { path: '/' })
}

export async function isAdmin(event: H3Event) {
  const { sessionSecret } = useRuntimeConfig(event)
  if (!sessionSecret) return false

  const token = getCookie(event, COOKIE)
  if (!token) return false

  const [expires, signature] = token.split('.')
  if (!expires || !signature) return false
  if (Number(expires) < Date.now()) return false

  return safeEqual(signature, await hmacHex(sessionSecret, expires))
}

export async function requireAdmin(event: H3Event) {
  if (!await isAdmin(event)) {
    throw httpError(401, '需要先登录')
  }
}
