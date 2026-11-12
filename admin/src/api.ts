import type {
  CleanupResult,
  GitSyncStatus,
  DashboardStats,
  FriendLink,
  ImageItem,
  NavItem,
  NavResponse,
  PageDetail,
  PageListResponse,
  SettingsResponse,
  SiteSettings,
  UnusedImages,
} from '@/types'
import type { AdminCommentsResponse } from '../../app/types/blog'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const text = await response.text()

  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error(`接口返回了非 JSON 内容：${text.slice(0, 120)}`)
    }
  }

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `请求失败（HTTP ${response.status}）`
    throw new ApiError(message, response.status)
  }

  return data as T
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  gitStatus: () => request<GitSyncStatus>('/api/git/status'),
  gitFlush: () => request<GitSyncStatus>('/api/git/flush', json({})),
  commentSession: () => request<{ site: string; authed: boolean }>('/api/comments/session'),
  commentLogin: (site: string, password: string) =>
    request<{ site: string; authed: boolean }>('/api/comments/login', json({ site, password })),
  commentLogout: () => request('/api/comments/logout', json({})),
  comments: (status: string, offset: number) =>
    request<AdminCommentsResponse>(`/api/comments?status=${status}&offset=${offset}`),
  commentAction: (id: string, action: 'hide' | 'restore' | 'purge') =>
    request('/api/comments/action', json({ id, action })),
  dashboard: () => request<DashboardStats>('/api/dashboard'),

  listPages: () => request<PageListResponse>('/api/pages'),
  getLinks: () => request<PageDetail>('/api/links'),
  saveLinks: (friends: FriendLink[]) =>
    request<PageDetail>('/api/links', { ...json({ friends }), method: 'PUT' }),

  getNav: () => request<NavResponse>('/api/nav'),

  saveNav: (items: NavItem[]) =>
    request<NavResponse>('/api/nav', { ...json({ items }), method: 'PUT' }),

  getSettings: () => request<SettingsResponse>('/api/settings'),

  saveSettings: (settings: SiteSettings) =>
    request<SettingsResponse>('/api/settings', { ...json({ settings }), method: 'PUT' }),

  listImages: () => request<{ images: ImageItem[] }>('/api/images'),

  uploadImage: (name: string, blob: Blob) =>
    request<{ image: ImageItem; reused: boolean }>(`/api/images?name=${encodeURIComponent(name)}`, {
      method: 'POST',
      body: blob,
    }),

  unusedImages: () => request<UnusedImages>('/api/images/unused'),

  cleanupImages: (names: string[]) =>
    request<CleanupResult>('/api/images/cleanup', json({ names })),
}
