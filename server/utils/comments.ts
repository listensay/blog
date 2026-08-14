export interface CommentRow {
  id: string
  slug: string
  parent_id: string | null
  author: string
  email_hash: string | null
  website: string | null
  body: string
  visitor: string
  hidden: number
  created_at: number
}

export interface PublicComment {
  id: string
  author: string
  website: string | null
  body: string
  createdAt: number
  /** 头像色相，前端用它加首字渲染色块 */
  hue: number
  /** 回复对象的昵称，顶层评论为 null */
  replyTo: string | null
  replies: PublicComment[]
}

/**
 * 头像本地生成（色块 + 首字），不走 Gravatar：
 * 既不把邮箱哈希发到第三方，也不让读者的 IP 暴露给外部图床。
 * 只回传 0-359 的色相，反推不出邮箱。
 */
function hueOf(row: CommentRow) {
  const seed = row.email_hash || row.author
  let hue = 0
  for (let i = 0; i < seed.length; i++) {
    hue = (hue * 31 + seed.charCodeAt(i)) % 360
  }
  return hue
}

/** email_hash / visitor 是内部字段，任何情况下都不出现在响应里 */
function toPublic(row: CommentRow, replyTo: string | null): PublicComment {
  return {
    id: row.id,
    author: row.author,
    website: row.website || null,
    body: row.body,
    createdAt: row.created_at,
    hue: hueOf(row),
    replyTo,
    replies: [],
  }
}

/**
 * 只做一层嵌套：回复的回复也挂到同一个顶层评论下，靠 replyTo 说明对象。
 * 这样缩进不会越来越深，手机上也读得下去。
 */
export function buildTree(rows: CommentRow[]): PublicComment[] {
  const byId = new Map(rows.map(row => [row.id, row]))
  const roots: PublicComment[] = []
  const nodes = new Map<string, PublicComment>()

  // 沿 parent_id 一路往上找顶层评论；父评论已被删就返回 undefined
  function rootOf(row: CommentRow): CommentRow | undefined {
    let current = row
    // 加步数上限，防止脏数据形成环时死循环
    for (let step = 0; step < 32; step++) {
      if (!current.parent_id) return current
      const parent = byId.get(current.parent_id)
      if (!parent) return undefined
      current = parent
    }
    return undefined
  }

  // rows 已按时间升序，父评论一定先于子评论出现
  for (const row of rows) {
    const parent = row.parent_id ? byId.get(row.parent_id) : undefined
    const root = row.parent_id ? rootOf(row) : row

    // 顶层评论，或者父链断了（父评论被删）的回复：都当顶层展示，不让它跟着消失
    if (!root || root.id === row.id) {
      const node = toPublic(row, null)
      nodes.set(row.id, node)
      roots.push(node)
      continue
    }

    const node = toPublic(row, parent?.author ?? null)
    nodes.set(row.id, node)
    nodes.get(root.id)?.replies.push(node)
  }

  return roots
}
