/** Preview repository images through the local admin server. */
export function toSitePreviewSrc(src: string): string {
  if (!src || !src.startsWith('/') || src.startsWith('//')) return src
  return `/blog-public${src}`
}
