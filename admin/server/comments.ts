import type { Workspace } from './paths.ts'
import { readSettings } from './settings.ts'
import { badRequest, HttpError } from './http.ts'

export class CommentAdmin {
  private cookie = ''
  private origin = ''
  private readonly ws: Workspace
  constructor(ws: Workspace) {
    this.ws = ws
  }

  async session() {
    const site = this.origin || (await readSettings(this.ws)).settings.site.url
    if (!this.cookie) return { site, authed: false }
    const result = (await this.request('/session')) as { authed: boolean }
    if (!result.authed) this.cookie = ''
    return { site, authed: result.authed }
  }

  async login(input: { site?: unknown; password?: unknown }) {
    let site: URL
    try {
      site = new URL(String(input.site ?? ''))
    } catch {
      throw badRequest('请输入完整的站点地址')
    }
    if (
      (site.protocol !== 'https:' &&
        !(
          site.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(site.hostname)
        )) ||
      site.username ||
      site.password ||
      site.search ||
      site.hash ||
      site.pathname !== '/'
    )
      throw badRequest('站点地址应为 HTTPS 地址或本机 HTTP 地址')
    if (typeof input.password !== 'string' || !input.password) throw badRequest('请输入管理密码')
    this.cookie = ''
    this.origin = site.origin
    await this.request('/login', {
      method: 'POST',
      body: JSON.stringify({ password: input.password }),
    })
    if (!this.cookie) throw new HttpError(502, '站点未返回登录会话')
    return this.session()
  }

  async logout() {
    try {
      if (this.cookie) await this.request('/logout', { method: 'POST' })
    } finally {
      this.cookie = ''
    }
    return { ok: true }
  }

  async list(status: string, offset: string) {
    this.requireSession()
    if (!['all', 'visible', 'hidden'].includes(status)) throw badRequest('评论状态无效')
    const start = Number(offset)
    if (!Number.isSafeInteger(start) || start < 0) throw badRequest('分页位置无效')
    return this.request(`/comments?status=${status}&limit=50&offset=${start}`)
  }

  async act(input: { id?: unknown; action?: unknown }) {
    this.requireSession()
    if (
      typeof input.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id)
    )
      throw badRequest('评论标识无效')
    if (!['hide', 'restore', 'purge'].includes(String(input.action)))
      throw badRequest('评论操作无效')
    const suffix =
      input.action === 'restore' ? '/restore' : input.action === 'purge' ? '?purge=1' : ''
    return this.request(`/comments/${input.id}${suffix}`, {
      method: input.action === 'restore' ? 'POST' : 'DELETE',
    })
  }

  close() {
    this.cookie = ''
  }
  private requireSession() {
    if (!this.cookie) throw new HttpError(401, '请先登录评论管理')
  }
  private async request(route: string, init: RequestInit = {}) {
    let response: Response
    try {
      response = await fetch(`${this.origin}/api/admin${route}`, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(20_000),
        headers: {
          'content-type': 'application/json',
          ...(this.cookie ? { cookie: this.cookie } : {}),
        },
      })
    } catch {
      throw new HttpError(502, '无法连接评论服务，请检查站点地址和网络')
    }
    const session = response.headers.getSetCookie().find((value) => value.startsWith('blog_admin='))
    if (session) this.cookie = session.split(';')[0] ?? ''
    const result = (await response.json().catch(() => null)) as Record<string, unknown> | null
    if (response.status === 401) this.cookie = ''
    if (!response.ok)
      throw new HttpError(
        response.status,
        String(
          result?.statusMessage || result?.message || `评论服务请求失败（HTTP ${response.status}）`,
        ),
      )
    if (!result) throw new HttpError(502, '评论服务返回的数据无效')
    return result
  }
}
