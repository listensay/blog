// 前端与本地 API 之间的数据契约。浏览器和 Vite 的 Node 进程同时引用它，
// 所以只放纯类型，别 import 任何运行时代码。

/** frontmatter 里由 content.config.ts 的 schema 明确声明的字段 */
export interface PostFrontmatter {
  title: string
  description: string
  /** 发布时间，格式固定 `YYYY-MM-DD HH:mm`。不带秒才是纯字符串，没有时区能把日期挪走；老文章只有日期时按 `00:00` 处理 */
  date: string
  /** URL 片段。文件名是中文，网址靠这个（见 blog/transformers/slug-path.ts） */
  slug: string
  /** frontmatter 里的 path 字段。实际 URL 由 slug 决定，这里只是原样保留 */
  path: string
  category: string
  tags: string[]
  draft: boolean
  /** 封面图，写法同正文图片（相对路径） */
  cover: string
}

/** 列表页要用的一条文章 */
export interface PostSummary extends PostFrontmatter {
  /** 相对 `content/` 的路径，如 `blog/ai/免费AI公益中转站收集分享.md`，全站唯一，当 id 用 */
  file: string
  /** 相对 `content/blog/` 的子目录，如 `ai`；顶层文章为空串 */
  dir: string
  /** 不含 `.md` 的文件名 */
  name: string
  /** slug-path transformer 真正会生成的 URL，用来和 frontmatter 的 path 对照 */
  realPath: string
  /** 文件 mtime（毫秒） */
  mtime: number
  /** 字节数 */
  bytes: number
  /** 正文里出现的图片数量，列表页显示用 */
  images: number
}

/** 编辑页要用的一篇文章 */
export interface PostDetail extends PostSummary {
  /** frontmatter 之后的原文，**逐字节保留**（含开头的空行） */
  body: string
  // 原文 frontmatter 的整份对象，保存时原样传回去。服务端靠它保住后台不认识的字段，
  // 并分辨「这个键本来就是空的」和「用户刚清空的」（仓库里有文章写着光秃秃的 `tags:`）。
  raw: Record<string, unknown>
}

/** 新建 / 保存时提交的内容 */
export interface PostInput extends PostFrontmatter {
  dir: string
  name: string
  body: string
  /** 见 PostDetail.raw。新建文章时不用传 */
  raw?: Record<string, unknown>
}

export interface PostListResponse {
  posts: PostSummary[]
  /** 现有文章里出现过的分类 / 标签 / 子目录，给下拉框当候选 */
  categories: string[]
  tags: string[]
  dirs: string[]
}

export interface ImageItem {
  /** 文件名，如 `Pasted image 20260819182328.png` */
  name: string
  bytes: number
  mtime: number
  /** 浏览器里能直接看的预览地址，如 `/blog-public/images/x.png` */
  previewUrl: string
}

export interface WorkspaceInfo {
  /** blog 项目根的绝对路径，界面上显示出来，确认在改哪个仓库 */
  blogRoot: string
  postCount: number
  pageCount: number
  imageCount: number
}

export interface ApiError {
  error: string
}

/* --------------------------------------------------------------------- 固定页 */

/** 一条友情链接。只有 `/links` 那个页面会渲染它 */
export interface FriendLink {
  name: string
  /** http(s) 外链，或 `/` 开头的站内路径 */
  url: string
  description: string
  /** 头像。只能写站点绝对路径（`/images/x.png`）或 http(s)：这个字段不会被 image-src 改写，相对路径线上会 404 */
  avatar?: string
}

/** 固定页 frontmatter 里由 content.config.ts 声明的字段 */
export interface PageFrontmatter {
  title: string
  description: string
  friends: FriendLink[]
}

/** 列表页要用的一个页面 */
export interface PageSummary extends PageFrontmatter {
  /** 相对 `content/` 的路径，如 `pages/about.md`，当 id 用 */
  file: string
  /** 不含 `.md` 的文件名，如 `about`。它就是网址（`/about`），改名等于换 URL */
  name: string
  /** 站点上的 URL，由 name 算出来 */
  path: string
  /** 站点上有专属 .vue 在渲染它（目前只有 `/links`）。这种页面删掉或改名不会 404，只会变成空页面，确认框文案靠它区分 */
  customRoute: boolean
  /** 文件 mtime（毫秒） */
  mtime: number
  bytes: number
  /** 正文里出现的图片数量 */
  images: number
}

/** 编辑页要用的一个页面 */
export interface PageDetail extends PageSummary {
  /** frontmatter 之后的原文，**逐字节保留** */
  body: string
  /** 见 PostDetail.raw，同一套「保住未知字段和空键」的机制 */
  raw: Record<string, unknown>
}

export interface PageInput extends PageFrontmatter {
  name: string
  body: string
  /** 见 PageDetail.raw。新建页面时不用传 */
  raw?: Record<string, unknown>
}

export interface PageListResponse {
  pages: PageSummary[]
  /** 不能用的文件名首段：站点在这些路径上有手写的页面，建了也访问不到 */
  reserved: string[]
}

/* ----------------------------------------------------------------------- 菜单 */

/** 一条顶部菜单。数据在 `content/data/nav.json`，站点侧由 app/utils/site.ts 读走 */
export interface NavItem {
  label: string
  /** 站内路径，必须以 `/` 开头 */
  to: string
  /** 图标名，取值见 NavResponse.icons */
  icon: string
  /** 主题色，`#rrggbb` */
  color: string
}

/** 图标下拉的一项：值 + 中文说明 */
export interface NavIconOption {
  value: string
  label: string
}

export interface NavResponse {
  items: NavItem[]
  /** 能选的图标（服务端给，前端不自己维护一份） */
  icons: NavIconOption[]
  /** 数据文件的相对路径，界面上显示出来 */
  file: string
  /** 文件还不存在（第一次保存时会创建） */
  missing?: boolean
  /** 文件存在但读不动（手改坏了）。界面据此提示「保存一次会覆盖成正确的」 */
  error?: string
}

/* ------------------------------------------------------------------------ AI */

// AI 能做的事。前四个进出都是 Markdown，走同一条返回分支；`meta` 产出 frontmatter 字段，单独一支。
// `fix` 只许改格式、不许改一个字，所以校验时会额外比对正文文字（见 utils/ai.ts 的 proseMustMatch）。
export type AiAction = 'fix' | 'polish' | 'condense' | 'expand' | 'meta'

/** 改写的作用范围。选中就只改那一段，否则改整篇 */
export type AiScope = 'selection' | 'all'

/** `GET /api/ai`：AI 有没有配好。没配好前端就把按钮禁掉，并把 hint 显示出来 */
export interface AiStatus {
  enabled: boolean
  /** 用的哪个模型，界面上显示出来，免得以为在用别的 */
  model: string
  /** 只回显 base URL，密钥永远不出服务端 */
  baseUrl: string
  /** 没配好时告诉用户该设哪个环境变量 */
  hint: string
}

export interface AiUsage {
  prompt: number
  completion: number
}

export interface AiRequest {
  action: AiAction
  scope: AiScope
  /** 要处理的 Markdown。`meta` 时是全文 */
  text: string
  // 给模型的背景信息，让它知道这篇在讲什么领域。
  // `meta` 动作里 title 还兼作参考：模型觉得现有标题够好就原样返回。
  title?: string
  category?: string
}

/** 改写动作（fix / polish / condense / expand）的结果 */
export interface AiTextResult {
  kind: 'text'
  text: string
  model: string
  usage: AiUsage | null
  /** 结果被输出长度上限截断了（`finish_reason: 'length'`）。这种结果不能直接用，界面上要拦 */
  truncated: boolean
}

// `meta` 的结果：四个 frontmatter 字段，各自独立能用能不用，所以任何一个空着都不算失败。
// slug 过不了格式校验时服务端会清空它，不让非法值混进表单（见 server/ai.ts 的 normalizeSlug）。
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
