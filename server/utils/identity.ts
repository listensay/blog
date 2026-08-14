import type { H3Event } from 'h3'

const encoder = new TextEncoder()

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Web Crypto 在 Workers 和 Node 18+ 都是全局的，两端同一份实现 */
export async function sha256Hex(input: string) {
  return toHex(await crypto.subtle.digest('SHA-256', encoder.encode(input)))
}

export async function hmacHex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)))
}

/** 定长比较，避免用 === 比密码/签名时泄漏前缀信息 */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

function clientIp(event: H3Event) {
  // Cloudflare 一定会带 CF-Connecting-IP，且它不可被客户端伪造
  return getRequestHeader(event, 'cf-connecting-ip')
    || getRequestIP(event, { xForwardedFor: true })
    || '0.0.0.0'
}

/**
 * 访客指纹：IP + UA 加盐哈希后截断。
 * 只存哈希不存明文 IP——去重和限流够用，同时不留可反查的个人数据。
 */
export async function visitorId(event: H3Event) {
  const salt = useRuntimeConfig(event).visitorSalt || 'blog-dev-salt'
  const ua = getRequestHeader(event, 'user-agent') || ''
  return (await sha256Hex(`${clientIp(event)}|${ua}|${salt}`)).slice(0, 32)
}

/** 邮箱只以哈希形态落库，用来生成稳定头像，永不回传给前端 */
export async function emailHash(email: string) {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null
  return (await sha256Hex(normalized)).slice(0, 32)
}
