import { taxonomyLink } from './taxonomy'

export type SiteLocale = 'zh-CN' | 'en'

export function pathLocale(path: string): SiteLocale {
  return path === '/en' || path.startsWith('/en/') ? 'en' : 'zh-CN'
}

export function unlocalizedPath(path: string): string {
  const normalized = path.replace(/\/+$/, '') || '/'
  return pathLocale(normalized) === 'en' ? normalized.slice(3) || '/' : normalized
}

export function localizedPath(path: string, locale: SiteLocale): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path
  const base = unlocalizedPath(path)
  return locale === 'en' ? (base === '/' ? '/en' : `/en${base}`) : base
}

interface LocalizedPost {
  path?: string
  category?: string
  tags?: string[]
}

export function contentPaths(locale: SiteLocale, posts: LocalizedPost[], pages: { path: string }[]): string[] {
  const paths = new Set(['/', '/blog', '/categories', '/tags'].map(path => localizedPath(path, locale)))
  for (const page of pages) paths.add(page.path)
  for (const post of posts) {
    if (!post.path) continue
    paths.add(post.path)
    if (post.category) paths.add(localizedPath(taxonomyLink('categories', post.category), locale))
    for (const tag of post.tags ?? []) paths.add(localizedPath(taxonomyLink('tags', tag), locale))
  }
  return [...paths]
}

export function languageAlternates(path: string, publishedPaths: string[]) {
  const zh = localizedPath(path, 'zh-CN')
  const en = localizedPath(path, 'en')
  if (!publishedPaths.includes(zh) || !publishedPaths.includes(en)) return []
  return [{ hreflang: 'zh-CN', path: zh }, { hreflang: 'en', path: en }]
}
