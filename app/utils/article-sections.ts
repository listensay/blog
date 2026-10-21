import type { MarkdownRoot, MinimarkNode } from '@nuxt/content'

export interface ArticleSection {
  id?: string
  number?: number
  body: MarkdownRoot
}

export function splitArticleSections(body: MarkdownRoot): ArticleSection[] {
  const headingTag = body.value.some(node => Array.isArray(node) && node[0] === 'h2') ? 'h2' : 'h3'
  const sections: ArticleSection[] = []
  let nodes: MinimarkNode[] = []
  let id: string | undefined
  let number: number | undefined
  let count = 0

  function append() {
    if (nodes.length) sections.push({ id, number, body: { ...body, value: nodes } })
  }

  for (const node of body.value) {
    if (Array.isArray(node) && node[0] === headingTag) {
      append()
      nodes = []
      id = typeof node[1].id === 'string' ? node[1].id : undefined
      number = ++count
    }
    nodes.push(node)
  }
  append()
  return sections
}
