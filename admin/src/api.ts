import type {
  CleanupResult,
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
  WorkspaceInfo,
} from '@/types'
import type { Project, ProjectsResponse } from '../../app/types/project'

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
    throw new Error(message)
  }

  return data as T
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  getProjects: () => request<ProjectsResponse>('/api/projects'),

  saveProjects: (items: Project[], revision: string) =>
    request<ProjectsResponse>('/api/projects', { ...json({ items, revision }), method: 'PUT' }),

  workspace: () => request<WorkspaceInfo>('/api/workspace'),

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
