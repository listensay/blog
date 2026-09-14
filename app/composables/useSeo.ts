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
  const { locale, isEnglish, alternates, siteDescription } = useLocale()

  const canonical = computed(() => absoluteUrl(route.path))

  const pageTitle = computed(() => toValue(options.title)?.trim() || '')
  const fullTitle = computed(() =>
    pageTitle.value ? `${pageTitle.value} - ${siteConfig.title}` : siteConfig.title,
  )
  const description = computed(() => toValue(options.description)?.trim() || siteDescription.value)
  const image = computed(() => absoluteUrl(toValue(options.image)?.trim() || siteConfig.ogImage))

  useSeoMeta({
    title: () => fullTitle.value,
    description: () => description.value,

    ogTitle: () => fullTitle.value,
    ogDescription: () => description.value,
    ogType: options.type ?? 'website',
    ogUrl: () => canonical.value,
    ogSiteName: siteConfig.title,
    ogLocale: () => isEnglish.value ? 'en_US' : 'zh_CN',
    ogLocaleAlternate: () => alternates.value.length ? [isEnglish.value ? 'zh_CN' : 'en_US'] : undefined,
    ogImage: () => image.value,
    ogImageAlt: () => fullTitle.value,

    twitterCard: 'summary_large_image',
    twitterTitle: () => fullTitle.value,
    twitterDescription: () => description.value,
    twitterImage: () => image.value,

    articlePublishedTime: () => toValue(options.publishedTime) || undefined,

    robots: options.noindex ? 'noindex, nofollow' : undefined,
  })

  useHead(() => ({
    htmlAttrs: { lang: locale.value },
    link: options.noindex ? [] : [
      { rel: 'canonical', href: canonical.value },
      ...alternates.value.map(alternate => ({
        rel: 'alternate' as const, hreflang: alternate.hreflang, href: absoluteUrl(alternate.path),
      })),
    ],
  }))
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
