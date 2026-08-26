import type { H3Event } from 'h3'
import { queryCollection } from '@nuxt/content/server'

const known = new Set<string>()

export async function assertPostExists(event: H3Event, slug: string) {
  if (known.has(slug)) return

  const post = await queryCollection(event, 'blog')
    .where('slug', '=', slug)
    .where('draft', '=', false)
    .select('path')
    .first()

  if (!post) {
    throw httpError(404, '文章不存在')
  }

  known.add(slug)
}
