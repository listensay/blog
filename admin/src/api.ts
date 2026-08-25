// 和本地 API 说话的那一层（接口在 server/blog-api.ts）。
// 后端出错统一返回 `{ error: '中文说明' }`，这里抛成 Error，页面上直接显示就是一句人话。
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
      // 后端理论上只返回 JSON。真拿到别的东西（比如 Vite 的 HTML 错误页），
      // 把原文截一段抛出去，比一句 "Unexpected token <" 有用
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

  /* ------------------------------------------------------------------ 固定页 */

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

  /* -------------------------------------------------------------------- 菜单 */

  /** 顶部菜单，连同能选的图标一起拿回来 */
  getNav: () => request<NavResponse>('/api/nav'),

  /** 整份菜单一起存 */
  saveNav: (items: NavItem[]) =>
    request<NavResponse>('/api/nav', { ...json({ items }), method: 'PUT' }),

  /* -------------------------------------------------------------------- 图片 */

  listImages: () => request<{ images: ImageItem[] }>('/api/images'),

  /** 图片走裸二进制上传，文件名放查询参数 */
  uploadImage: (name: string, blob: Blob) =>
    request<{ image: ImageItem; reused: boolean }>(`/api/images?name=${encodeURIComponent(name)}`, {
      method: 'POST',
      body: blob,
    }),

  /** AI 配好了没（模型名、base URL；密钥不会回传） */
  aiStatus: () => request<AiStatus>('/api/ai'),

  /** 跑一个 AI 动作（密钥在服务端）。返回值是可辨识联合，靠 `kind` 分支 */
  ai: (input: AiRequest) => request<AiResult>('/api/ai', json(input)),
}
