import MarkdownIt from 'markdown-it'
import path from 'node:path'
import { badRequest } from './http.ts'

const markdown = new MarkdownIt({ html: true, linkify: true })

// Leave executable examples untouched when adjusting asset paths for /en/.
export function normalizeTranslationAssets(body: string, sourceFile: string): string {
  const protectedLines = new Set<number>()
  for (const token of markdown.parse(body, {})) {
    if ((token.type === 'fence' || token.type === 'code_block') && token.map) {
      for (let i = token.map[0]; i < token.map[1]; i++) protectedLines.add(i)
    }
  }
  return body
    .split('\n')
    .map((line, i) => {
      if (protectedLines.has(i)) return line
      return line
        .split(/(`+[^`]*`+)/)
        .map((part, j) => {
          if (j % 2) return part
          return part.replace(/(?:\.\.\/)+public\/[^\s"'<>)]*/g, (value) => {
            const resolved = path.posix.normalize(
              `/content/${path.posix.dirname(sourceFile)}/${value}`,
            )
            return resolved.startsWith('/public/') ? resolved.slice('/public'.length) : value
          })
        })
        .join('')
    })
    .join('\n')
}

function structure(body: string) {
  const code: string[] = []
  const urls: string[] = []
  const headings: string[] = []
  const html: string[] = []
  const visit = (tokens: ReturnType<typeof markdown.parse>) => {
    for (const token of tokens) {
      if (['fence', 'code_block', 'code_inline'].includes(token.type))
        code.push(`${token.type}:${token.info}:${token.content}`)
      if (token.type === 'heading_open') headings.push(token.tag)
      for (const name of ['href', 'src']) {
        const value = token.attrGet(name)
        if (value) urls.push(String(value))
      }
      if (token.type === 'html_inline' || token.type === 'html_block') {
        html.push(...(token.content.match(/<\/?[a-z][^>]*>/gi) ?? []))
      }
      if (token.children) visit(token.children)
    }
  }
  visit(markdown.parse(body, {}))
  return { code, urls: urls.sort(), headings, html }
}

export function validateTranslationBody(source: string, translated: string): void {
  const before = structure(source)
  const after = structure(translated)
  for (const [key, label] of [
    ['code', '代码'],
    ['urls', '链接或图片地址'],
    ['headings', '标题层级'],
    ['html', 'HTML 标签'],
  ] as const) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      throw badRequest(`英文译文改变了${label}，请修正后保存，或重新生成译文。`)
    }
  }
}
