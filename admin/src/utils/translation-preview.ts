import { mdToHtml, PUBLIC_MOUNT, toPreviewSrc, toSitePreviewSrc } from './markdown.ts'

export function translationPreviewHtml(body: string, contentDir: string): string {
  const document = new DOMParser().parseFromString(mdToHtml(body, contentDir), 'text/html')
  for (const element of document.querySelectorAll('img[src], video, audio[src], source[src]')) {
    for (const attribute of ['src', 'poster']) {
      const src = element.getAttribute(attribute)
      if (!src) continue
      const preview = toPreviewSrc(src, contentDir)
      element.setAttribute(
        attribute,
        preview.startsWith(`${PUBLIC_MOUNT}/`) ? preview : toSitePreviewSrc(preview),
      )
    }
  }
  return document.body.innerHTML
}
