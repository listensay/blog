/**
 * 前端与本地 API 之间的数据契约。
 *
 * 这个文件被两边同时引用：`src/**` 跑在浏览器里，`server/**` 跑在 Vite 的 Node
 * 进程里（见 server/blog-api.ts）。里面只允许放**纯类型**，不要 import 任何运行时
 * 代码 —— 服务端用 `import type` 引它，构建时会被完全擦除。
 */

/** frontmatter 里由 content.config.ts 的 schema 明确声明的字段 */
export interface PostFrontmatter {
  title: string
  description: string
  /**
   * 发布时间，格式固定 `YYYY-MM-DD HH:mm`（本地时间，不带秒）。
   *
   * 不带秒是刻意的：这个写法在 YAML 1.1 和 1.2 里**都是纯字符串**，
   * 没有哪一层解析会把它变成 Date，也就没有时区能把日期挪走。
   * 只写了日期的老文章按当天 `00:00` 处理。
   */
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
  /**
   * 原文 frontmatter 解析出来的**整份**对象。保存时原样传回去，服务端靠它做两件事：
   * 把后台不认识的字段写回原位；分辨「这个键本来就是空的」和「用户刚清空的」
   * （仓库里有文章写着光秃秃的 `tags:`，不能一保存就给人删了）。
   */
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
  imageCount: number
}

export interface ApiError {
  error: string
}
