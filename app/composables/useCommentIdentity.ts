export interface CommentIdentity {
  author: string
  email: string
  website: string
}

const STORAGE_KEY = 'blog:comment-identity'

export function useCommentIdentity() {
  const identity = useState<CommentIdentity>('comment-identity', () => ({
    author: '',
    email: '',
    website: '',
  }))

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
    }
  })

  function remember() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(identity.value))
    }
    catch {
    }
  }

  return { identity, remember }
}
