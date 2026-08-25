import type { H3Event } from 'h3'
import { queryCollection } from '@nuxt/content/server'

// 已确认存在的 slug 缓存，每个 isolate 一份，重新部署自然失效。
// 只缓存「存在」的结果：查不到的每次都重查，新文章一发布就能点赞/评论
const known = new Set<string>()

/** 确认 slug 真对应一篇已发布文章，挡掉往任意 slug 灌浏览/点赞/评论数据 */
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
