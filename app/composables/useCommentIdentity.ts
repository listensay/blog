export interface CommentIdentity {
  author: string
  email: string
  website: string
}

const STORAGE_KEY = 'blog:comment-identity'

/** 昵称/邮箱/网址在所有评论框之间共享并记在浏览器里，只存本地，不会随评论一起公开 */
export function useCommentIdentity() {
  const identity = useState<CommentIdentity>('comment-identity', () => ({
    author: '',
    email: '',
    website: '',
  }))

  // localStorage 只有客户端有，且要等 hydration 之后再填，否则会和服务端渲染的空值打架
  onMounted(() => {
    if (identity.value.author || identity.value.email || identity.value.website) return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as Partial<CommentIdentity>
      identity.value = {
        author: String(saved.author ?? ''),
        email: String(saved.email ?? ''),
        website: String(saved.website ?? ''),
      }
    }
    catch {
      // 存的东西坏了就当没存过
    }
  })

  function remember() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(identity.value))
    }
    catch {
      // 隐私模式下可能写不进去，忽略
    }
  }

  return { identity, remember }
}
