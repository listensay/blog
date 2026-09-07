export interface PostStats {
  views: number
  likes: number
  comments: number
  liked: boolean
}

// 统计与评论的目标：文章用 slug，页面用站内路径去掉开头的 /。
export interface EngagementTarget {
  kind: 'post' | 'page'
  id: string
}

export interface CommentNode {
  id: string
  author: string
  website: string | null
  body: string
  createdAt: number
  hue: number
  replyTo: string | null
  replies: CommentNode[]
}

export interface CommentListResponse {
  total: number
  comments: CommentNode[]
}

export interface AdminComment {
  id: string
  target: string
  kind: 'post' | 'page'
  path: string | null
  parentId: string | null
  author: string
  website: string | null
  body: string
  hidden: boolean
  createdAt: number
  visitor: string
}

export interface AdminCommentsResponse {
  summary: { total: number, visible: number, hidden: number }
  comments: AdminComment[]
}
