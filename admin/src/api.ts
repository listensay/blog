import type {
  AiRequest,
  AiResult,
  AiStatus,
  ImageItem,
  NavItem,
  NavResponse,
  PageDetail,
  PageInput,
  PageListResponse,
  PostDetail,
  PostInput,
  PostListResponse,
  SettingsResponse,
  SiteSettings,
  WorkspaceInfo,
} from '@/types'

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
  workspace: () => request<WorkspaceInfo>('/api/workspace'),

  listPosts: () => request<PostListResponse>('/api/posts'),

  getPost: (file: string) => request<PostDetail>(`/api/post?file=${encodeURIComponent(file)}`),

  createPost: (input: PostInput) => request<PostDetail>('/api/post', json(input)),

  updatePost: (file: string, input: PostInput) =>
    request<PostDetail>(`/api/post?file=${encodeURIComponent(file)}`, {
      ...json(input),
      method: 'PUT',
    }),

  deletePost: (file: string) =>
    request<{ trashed: string }>(`/api/post?file=${encodeURIComponent(file)}`, {
      method: 'DELETE',
    }),

  listPages: () => request<PageListResponse>('/api/pages'),

  getPage: (file: string) => request<PageDetail>(`/api/page?file=${encodeURIComponent(file)}`),

  createPage: (input: PageInput) => request<PageDetail>('/api/page', json(input)),

  updatePage: (file: string, input: PageInput) =>
    request<PageDetail>(`/api/page?file=${encodeURIComponent(file)}`, {
      ...json(input),
      method: 'PUT',
    }),

  deletePage: (file: string) =>
    request<{ trashed: string }>(`/api/page?file=${encodeURIComponent(file)}`, {
      method: 'DELETE',
    }),

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

  aiStatus: () => request<AiStatus>('/api/ai'),

  ai: (input: AiRequest) => request<AiResult>('/api/ai', json(input)),
}
