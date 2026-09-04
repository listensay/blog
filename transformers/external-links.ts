import { readFileSync } from 'node:fs'

import { defineTransformer } from '@nuxt/content'

const SITE_FILE = 'content/data/site.json'

type MinimarkNode = string | [string, Record<string, unknown>, ...MinimarkNode[]]

/**
 * 站点自己的域名。读不到就返回空串，此时所有绝对地址都算外链 ——
 * 与 app/components/AppActionIcon.vue 的判断一致，是安全的降级方向。
 */
function siteHost(): string {
  const candidates = [SITE_FILE]
  try {
    candidates.push(new URL(`../${SITE_FILE}`, import.meta.url).pathname)
  }
  catch {
    // import.meta.url 不可用时只试 cwd
  }

  for (const path of candidates) {
    try {
      const url = (JSON.parse(readFileSync(path, 'utf8')) as { site?: { url?: unknown } }).site?.url
      if (typeof url === 'string' && url) return new URL(url).host.toLowerCase()
    }
    catch {
      continue
    }
  }

  return ''
}

const HOST = siteHost()

/** 只处理 http(s) 与协议相对地址；mailto:、tel:、站内相对路径和锚点都不算外链 */
function isExternal(href: string): boolean {
  const url = href.trim()
  if (!url) return false

  let host: string
  if (url.startsWith('//')) {
    host = url.slice(2).split(/[/?#]/)[0] ?? ''
  }
  else if (/^https?:\/\//i.test(url)) {
    try {
      host = new URL(url).host
    }
    catch {
      return false
    }
  }
  else {
    return false
  }

  host = host.toLowerCase()
  if (!host) return false
  return !HOST || host !== HOST
}

/**
 * 推广链接的判定：查询参数里带邀请码/推广码。命中的额外加 `nofollow sponsored`。
 * 编辑性质的外链（引用来源、官网首页）不命中，照旧只有 `noopener noreferrer`。
 */
const PROMO_PARAMS = new Set([
  'aff',
  'affid',
  'aff_id',
  'invite',
  'invitecode',
  'inviter',
  'promo',
  'promocode',
  'ref',
  'refcode',
  'referral',
  'referrer',
])

function isPromotional(href: string): boolean {
  const url = href.trim()
  const absolute = url.startsWith('//') ? `https:${url}` : url

  let params: URLSearchParams
  try {
    params = new URL(absolute).searchParams
  }
  catch {
    return false
  }

  for (const [rawKey, value] of params) {
    const key = rawKey.toLowerCase()
    if (PROMO_PARAMS.has(key)) return true
    // Telegram 机器人的邀请链接长这样：?start=ref_123456
    if (key === 'start' && /^ref[-_]/i.test(value)) return true
  }

  return false
}

function rewriteTree(nodes: MinimarkNode[]): number {
  let count = 0

  for (const node of nodes) {
    if (!Array.isArray(node)) continue

    const [tag, props, ...children] = node
    if (
      String(tag).toLowerCase() === 'a'
      && props
      && typeof props === 'object'
      && typeof props.href === 'string'
      && isExternal(props.href)
    ) {
      props.target = '_blank'
      props.rel = isPromotional(props.href)
        ? 'nofollow sponsored noopener noreferrer'
        : 'noopener noreferrer'
      count += 1
    }

    count += rewriteTree(children as MinimarkNode[])
  }

  return count
}

export default defineTransformer({
  name: 'external-links',
  extensions: ['.md'],
  transform(file) {
    const body = (file as Record<string, unknown>).body as { value?: unknown } | undefined
    if (body && Array.isArray(body.value)) {
      rewriteTree(body.value as MinimarkNode[])
    }
    return file
  },
})
