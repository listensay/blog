export function useLocale() {
  const route = useRoute()
  const i18n = useI18n()
  const { t, te } = i18n
  const locale = computed<SiteLocale>(() => i18n.locale.value === 'en' ? 'en' : 'zh-CN')
  const localePath = useLocalePath()
  const switchLocalePath = useSwitchLocalePath()
  const mounted = ref(false)
  onMounted(() => { mounted.value = true })
  const isEnglish = computed(() => locale.value === 'en')
  const blogCollection = computed(() => isEnglish.value ? 'blogEn' as const : 'blog' as const)
  const pagesCollection = computed(() => isEnglish.value ? 'pagesEn' as const : 'pages' as const)
  const { data: publishedPaths } = useNuxtData<string[]>('localized-paths')
  const alternates = computed(() => languageAlternates(route.path, publishedPaths.value ?? []))
  const switchPath = computed(() => {
    const targetLocale = isEnglish.value ? 'zh-CN' : 'en'
    const resolved = switchLocalePath(targetLocale)
    // URL fragments are only available in the browser, after hydration.
    const target = mounted.value ? resolved : resolved.split('#')[0] || ''
    const path = target.split(/[?#]/)[0]?.replace(/\/+$/, '') || '/'
    return target && publishedPaths.value?.includes(path) ? target : localePath('/blog', targetLocale)
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
