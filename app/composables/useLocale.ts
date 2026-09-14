export function useLocale() {
  const route = useRoute()
  const i18n = useI18n()
  const { t, te } = i18n
  const locale = computed<SiteLocale>(() => i18n.locale.value === 'en' ? 'en' : 'zh-CN')
  const localePath = useLocalePath()
  const isEnglish = computed(() => locale.value === 'en')
  const blogCollection = computed(() => isEnglish.value ? 'blogEn' as const : 'blog' as const)
  const pagesCollection = computed(() => isEnglish.value ? 'pagesEn' as const : 'pages' as const)
  const { data: publishedPaths } = useNuxtData<string[]>('localized-paths')
  const alternates = computed(() => languageAlternates(route.path, publishedPaths.value ?? []))
  const switchPath = computed(() => {
    const target = localizedPath(route.path, isEnglish.value ? 'zh-CN' : 'en')
    return publishedPaths.value?.includes(target) ? target : isEnglish.value ? '/blog' : '/en/blog'
  })
  const switchLabel = computed(() => {
    const paired = alternates.value.length > 0
    return t(isEnglish.value ? paired ? 'switchToChinese' : 'browseChinese' : paired ? 'switchToEnglish' : 'browseEnglish')
  })
  const localPath = (path: string) => path === '/feed.xml'
    ? localizedPath(path, locale.value)
    : localePath(unlocalizedPath(path), locale.value)
  const siteDescription = computed(() => isEnglish.value ? t('site.description') : siteConfig.description)
  const siteBio = computed(() => isEnglish.value ? t('site.bio') : siteConfig.profile.bio)
  const taxonomyLabel = (name: string, kind: 'category' | 'tag') => {
    const key = `taxonomy.${taxonomySlug(name, kind)}`
    return te(key) ? t(key) : name
  }

  return { locale, isEnglish, blogCollection, pagesCollection, publishedPaths, alternates, switchPath, switchLabel, localPath, t, te, taxonomyLabel, siteDescription, siteBio }
}
