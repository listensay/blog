export interface PostStats {
  views: number
  likes: number
  comments: number
  liked: boolean
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
  slug: string
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
