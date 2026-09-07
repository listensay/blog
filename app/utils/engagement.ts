import type { EngagementTarget } from '~/types/blog'

// 统计与评论接口分两套：文章按 slug 取，页面按站内路径取。
// 页面路径可能带目录（sub/page），拼进接口地址时按原样作为多个路径段。

export function postTarget(slug: string): EngagementTarget {
  return { kind: 'post', id: slug }
}

export function pageTarget(path: string): EngagementTarget {
  return { kind: 'page', id: path.replace(/^\//, '') }
}

export function statsKey(target: EngagementTarget) {
  return `stats-${target.kind}-${target.id}`
}

export function commentsKey(target: EngagementTarget) {
  return `comments-${target.kind}-${target.id}`
}

export function statsUrl(target: EngagementTarget) {
  return target.kind === 'post'
    ? `/api/posts/${target.id}/stats`
    : `/api/pages/stats/${target.id}`
}

export function likeUrl(target: EngagementTarget) {
  return target.kind === 'post'
    ? `/api/posts/${target.id}/like`
    : `/api/pages/like/${target.id}`
}

export function commentsUrl(target: EngagementTarget) {
  return target.kind === 'post'
    ? `/api/posts/${target.id}/comments`
    : `/api/pages/comments/${target.id}`
}

// 只有文章统计阅读量。
export function viewUrl(target: EngagementTarget) {
  return target.kind === 'post' ? `/api/posts/${target.id}/view` : null
}
