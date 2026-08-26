import type { MaybeRefOrGetter } from 'vue'

export interface SeoOptions {
  title?: MaybeRefOrGetter<string | undefined | null>
  description?: MaybeRefOrGetter<string | undefined | null>
  image?: MaybeRefOrGetter<string | undefined | null>
  type?: 'website' | 'article'
  publishedTime?: MaybeRefOrGetter<string | undefined | null>
  noindex?: boolean
}

function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path
  return siteConfig.url + (path.startsWith('/') ? path : `/${path}`)
}

export function useSeo(options: SeoOptions = {}): void {
  const route = useRoute()

  const canonical = computed(() => absoluteUrl(route.path))

  const pageTitle = computed(() => toValue(options.title)?.trim() || '')
  const fullTitle = computed(() =>
    pageTitle.value ? `${pageTitle.value} - ${siteConfig.title}` : siteConfig.title,
  )
  const description = computed(() => toValue(options.description)?.trim() || siteConfig.description)
  const image = computed(() => absoluteUrl(toValue(options.image)?.trim() || siteConfig.ogImage))

  useSeoMeta({
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
    link: options.noindex ? [] : [{ rel: 'canonical', href: () => canonical.value }],
  })
}

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
