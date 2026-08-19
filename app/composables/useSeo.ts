import type { MaybeRefOrGetter } from 'vue'

/**
 * 页面 SEO 元信息的统一入口。
 *
 * 在 useSeoMeta 之上补齐了每个页面都该有、但一个个页面写会漏的东西：
 * canonical、og:*、twitter:*。各页面只需要给「标题（不含站点名）」和描述。
 *
 * 全部参数都接受 getter，因为列表/详情页的取数是 lazy 的 —— 标题要等数据回来
 * 才有值，写成常量会把 SSR 之后的更新丢掉。
 */
export interface SeoOptions {
  /** 页面标题，**不含站点名**。留空表示只用站点名（首页） */
  title?: MaybeRefOrGetter<string | undefined | null>
  description?: MaybeRefOrGetter<string | undefined | null>
  /** 社交卡片图；相对路径会补成绝对 URL，留空用站点默认图 */
  image?: MaybeRefOrGetter<string | undefined | null>
  /** og:type，文章页传 article */
  type?: 'website' | 'article'
  /** 文章发布时间（ISO），输出成 article:published_time */
  publishedTime?: MaybeRefOrGetter<string | undefined | null>
  /** 后台、错误页这类不该被收录的页面 */
  noindex?: boolean
}

/** 相对路径补成绝对 URL —— og:image / canonical 都要求绝对地址 */
function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path
  return siteConfig.url + (path.startsWith('/') ? path : `/${path}`)
}

export function useSeo(options: SeoOptions = {}): void {
  const route = useRoute()

  // canonical 只取 path，不带 query：分页/筛选参数不该分裂成多个规范 URL。
  // route.path 里的中文本来就是 percent-encoded 的，直接拼即可。
  const canonical = computed(() => absoluteUrl(route.path))

  const pageTitle = computed(() => toValue(options.title)?.trim() || '')
  // 社交卡片没有 titleTemplate 这套机制，得自己拼出完整标题
  const fullTitle = computed(() =>
    pageTitle.value ? `${pageTitle.value} - ${siteConfig.title}` : siteConfig.title,
  )
  const description = computed(() => toValue(options.description)?.trim() || siteConfig.description)
  const image = computed(() => absoluteUrl(toValue(options.image)?.trim() || siteConfig.ogImage))

  useSeoMeta({
    // 只给页面标题，站点名由 app.vue 的 titleTemplate 追加
    title: () => pageTitle.value || undefined,
    description: () => description.value,

    ogTitle: () => fullTitle.value,
    ogDescription: () => description.value,
    ogType: options.type ?? 'website',
    ogUrl: () => canonical.value,
    ogSiteName: siteConfig.title,
    ogLocale: 'zh_CN',
    ogImage: () => image.value,
    ogImageAlt: () => fullTitle.value,

    twitterCard: 'summary_large_image',
    twitterTitle: () => fullTitle.value,
    twitterDescription: () => description.value,
    twitterImage: () => image.value,

    articlePublishedTime: () => toValue(options.publishedTime) || undefined,

    robots: options.noindex ? 'noindex, nofollow' : undefined,
  })

  useHead({
    // noindex 的页面（后台、错误页）不给 canonical：既说别收录又指一个规范地址，
    // 是自相矛盾的信号
    link: options.noindex ? [] : [{ rel: 'canonical', href: () => canonical.value }],
  })
}

/**
 * 输出一段 JSON-LD 结构化数据。
 *
 * 用 innerHTML 直接塞进 script 标签，所以必须把 `<` 转义掉 —— 否则正文标题里
 * 一个 `</script>` 就能提前闭合标签。`<` 在 JSON 里和 `<` 等价，解析不受影响。
 */
export function useJsonLd(data: MaybeRefOrGetter<Record<string, unknown>>): void {
  useHead({
    script: [{
      type: 'application/ld+json',
      innerHTML: () => JSON.stringify({
        '@context': 'https://schema.org',
        ...toValue(data),
      }).replaceAll('<', '\\u003c'),
    }],
  })
}
