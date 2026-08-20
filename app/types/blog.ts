/** 一篇文章的浏览量/点赞数，以及当前访客是否点过赞 */
export interface PostStats {
  views: number
  likes: number
  comments: number
  liked: boolean
}

/** 公开评论节点，回复只嵌一层（server/utils/comments.ts 里组装） */
export interface CommentNode {
  id: string
  author: string
  website: string | null
  body: string
  createdAt: number
  /** 头像色相 0-359，配合首字渲染色块 */
  hue: number
  /** 回复对象的昵称，顶层评论为 null */
  replyTo: string | null
  replies: CommentNode[]
}

export interface CommentListResponse {
  total: number
  comments: CommentNode[]
}

/** 管理端看到的扁平评论，含被隐藏的 */
export interface AdminComment {
  id: string
  slug: string
  parentId: string | null
  author: string
  website: string | null
  body: string
  hidden: boolean
  createdAt: number
  /** 访客指纹前 8 位，用来识别换名连发的同一个人 */
  visitor: string
}

export interface AdminCommentsResponse {
  summary: { total: number, visible: number, hidden: number }
  comments: AdminComment[]
}
