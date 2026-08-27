export interface PostFrontmatter {
  title: string
  description: string
  date: string
  slug: string
  path: string
  category: string
  tags: string[]
  draft: boolean
  cover: string
}

export interface PostSummary extends PostFrontmatter {
  file: string
  dir: string
  name: string
  realPath: string
  mtime: number
  bytes: number
  images: number
}

export interface PostDetail extends PostSummary {
  body: string
  raw: Record<string, unknown>
}

export interface PostInput extends PostFrontmatter {
  dir: string
  name: string
  body: string
  raw?: Record<string, unknown>
}

export interface PostListResponse {
  posts: PostSummary[]
  categories: string[]
  tags: string[]
  dirs: string[]
}

export interface ImageItem {
  name: string
  bytes: number
  mtime: number
  previewUrl: string
}

export interface WorkspaceInfo {
  blogRoot: string
  postCount: number
  pageCount: number
  imageCount: number
}

export interface ApiError {
  error: string
}

export interface FriendLink {
  name: string
  url: string
  description: string
  avatar?: string
}

export interface PageFrontmatter {
  title: string
  description: string
  friends: FriendLink[]
}

export interface PageSummary extends PageFrontmatter {
  file: string
  name: string
  path: string
  customRoute: boolean
  mtime: number
  bytes: number
  images: number
}

export interface PageDetail extends PageSummary {
  body: string
  raw: Record<string, unknown>
}

export interface PageInput extends PageFrontmatter {
  name: string
  body: string
  raw?: Record<string, unknown>
}

export interface PageListResponse {
  pages: PageSummary[]
  reserved: string[]
}

export interface NavItem {
  label: string
  to: string
  icon: string
  color: string
}

export interface NavIconOption {
  value: string
  label: string
}

export interface NavResponse {
  items: NavItem[]
  icons: NavIconOption[]
  file: string
  missing?: boolean
  error?: string
}

export interface SocialLink {
  icon: string
  label: string
  url: string
  color: string
}

export interface SocialIconOption {
  value: string
  label: string
}

/** 首页隐藏分类的候选项：value 是英文 slug，name 是文章里写的中文分类名 */
export interface CategoryOption {
  value: string
  name: string
}

/** 首页头像旁那块「我是谁」 */
export interface ProfileSettings {
  name: string
  bio: string
  avatar: string
  socials: SocialLink[]
}

/** 站点级设置：标题、描述、地址这些，SEO / RSS / sitemap 都读它 */
export interface SystemSettings {
  title: string
  description: string
  url: string
  ogImage: string
  utcOffset: string
  home: {
    postLimit: number
    hiddenCategories: string[]
  }
}

export interface SiteSettings {
  profile: ProfileSettings
  site: SystemSettings
}

export interface SettingsResponse {
  settings: SiteSettings
  icons: SocialIconOption[]
  categories: CategoryOption[]
  file: string
  missing?: boolean
  error?: string
}

export type AiAction = 'fix' | 'polish' | 'condense' | 'expand' | 'meta'

export type AiScope = 'selection' | 'all'

export interface AiStatus {
  enabled: boolean
  model: string
  baseUrl: string
  hint: string
}

export interface AiUsage {
  prompt: number
  completion: number
}

export interface AiRequest {
  action: AiAction
  scope: AiScope
  text: string
  title?: string
  category?: string
}

export interface AiTextResult {
  kind: 'text'
  text: string
  model: string
  usage: AiUsage | null
  truncated: boolean
}

export interface AiMetaResult {
  kind: 'meta'
  title: string
  slug: string
  description: string
  tags: string[]
  model: string
  usage: AiUsage | null
}

export type AiResult = AiTextResult | AiMetaResult
