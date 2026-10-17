import YAML from 'yaml'
import path from 'node:path'
import { POST_KEY_ORDER, PAGE_KEY_ORDER, serializeFile } from '../frontmatter.ts'
interface RemoteDoc { id: string; title: string }

const SEGMENT = '[a-z0-9]+(?:-[a-z0-9]+)*'
const SLUG = new RegExp(`^${SEGMENT}$`)
const ROUTE = new RegExp(`^${SEGMENT}(?:/${SEGMENT})*$`)
const RESERVED = new Set(['blog', 'categories', 'tags', 'admin', 'index', 'projects', 'en', 'api'])

function normalizeMarkdown(body: string, migrated: boolean): string {
  // AFFiNE imports raw HTML wrappers as code blocks and exports unset image
  // dimensions as zero. Restore migrated details wrappers, but leave examples
  // and explicitly sized images alone.
  return body
    .split(
      /(^`{3,}[^\n]*\n[\s\S]*?^`{3,}[ \t]*$|^~{3,}[^\n]*\n[\s\S]*?^~{3,}[ \t]*$|`+[^`\n]*`+)/gm,
    )
    .map((part, index) => {
      if (index % 2) {
        const html = /^(`{3,}|~{3,})html\s*\n([\s\S]*?)\n\1[ \t]*$/.exec(part)?.[2]?.trim()
        return migrated &&
          html &&
          /^(?:<details(?:\s+open)?>\s*<summary>[\s\S]*<\/summary>|<\/details>)$/.test(html)
          ? html
          : part
      }
      return part
        .replace(/<img\b[^>]*>/gi, (tag) => tag.replace(/\s+(?:width|height)=["']0["']/gi, ''))
        .replace(/^([ \t]*>)[ \t]+$/gm, '$1')
        .replace(/^[ \t]+$/gm, '')
    })
    .join('')
}

export interface BlogDocument {
  id: string
  title: string
  file: string
  path: string
  body: string
  data: Record<string, unknown>
  migrationRevision: string
  draft: boolean
}

// A normal YAML code block survives AFFiNE editing and Markdown export.
// Only an explicit `blog: true` marker opts a public document into the blog.
export function parseDocument(doc: RemoteDoc, markdown: string): BlogDocument | null {
  const blocks = [...markdown.matchAll(/^(`{3,}|~{3,})(?:yaml|yml)\s*\n([\s\S]*?)^\1\s*$/gm)]
  const matches: Array<{ data: Record<string, unknown>; text: string }> = []
  for (const block of blocks) {
    if (!/^blog:\s*true\s*$/m.test(block[2]!)) continue
    const data = YAML.parse(block[2]!, { maxAliasCount: 20 }) as unknown
    if (!data || typeof data !== 'object' || Array.isArray(data))
      throw new Error(`${doc.id}：博客配置无效`)
    if ((data as Record<string, unknown>).blog === true)
      matches.push({ data: data as Record<string, unknown>, text: block[0] })
  }
  if (!matches.length) return null
  if (matches.length !== 1) throw new Error(`${doc.id}：只能有一个 blog: true 配置块`)
  const { data: meta, text } = matches[0]!
  const fail = (message: string): never => {
    throw new Error(`${doc.title || doc.id}：${message}`)
  }
  const string = (key: string, fallback = ''): string => {
    if (meta[key] === undefined) return fallback
    return typeof meta[key] === 'string' ? meta[key].trim() : fail(`${key} 必须是文本`)
  }
  const kind = string('kind')
  if (kind !== 'post' && kind !== 'page') fail('kind 须为 post 或 page')
  const locale = string('locale', 'zh-CN')
  if (!['zh-CN', 'en'].includes(locale)) fail('locale 须为 zh-CN 或 en')
  const title = doc.title?.trim() || string('title')
  if (!title) fail('文档标题不能为空')
  const slug = string('slug')
  if (!(kind === 'post' ? SLUG : ROUTE).test(slug))
    fail('slug 须使用小写英文、数字、连字符；页面可包含子路径')
  const directory = string('directory')
  if (directory && !ROUTE.test(directory)) fail('directory 格式不正确')
  if (kind === 'page' && (directory || RESERVED.has(slug.split('/')[0]!)))
    fail('页面路径与内置路由冲突')
  const prefix = locale === 'en' ? 'en/' : ''
  const route = kind === 'post' ? ['blog', directory, slug].filter(Boolean).join('/') : slug
  const target = `/${prefix}${route}`
  const defaultFile = `${prefix}${kind === 'post' ? route : `pages/${slug}`}.md`
  const file = string('file', defaultFile)
  if (
    !isContentFile(file) ||
    (kind === 'post'
      ? path.posix.dirname(file) !== path.posix.dirname(defaultFile)
      : file !== defaultFile)
  )
    fail('file 必须与文章目录或页面路径一致')
  const data: Record<string, unknown> = { title, description: string('description') }
  for (const key of ['draft', 'comments']) {
    if (meta[key] !== undefined && typeof meta[key] !== 'boolean')
      fail(`${key} 必须是 true 或 false`)
  }
  if (kind === 'post') {
    const date = string('date')
    const match = /^(\d{4}-\d{2}-\d{2})(?: (\d{2}:\d{2}))?$/.exec(date)
    const parsed = match ? new Date(`${match[1]}T${match[2] || '00:00'}:00Z`) : null
    if (
      !parsed ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== match?.[1]
    )
      fail('date 须为有效的 YYYY-MM-DD 或 YYYY-MM-DD HH:mm')
    const tags = meta.tags ?? []
    if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== 'string'))
      fail('tags 须为文本数组')
    Object.assign(data, {
      date,
      slug,
      path: target,
      category: string('category', '未分类'),
      tags,
      draft: meta.draft === true,
    })
    const cover = string('cover')
    if (cover) data.cover = cover
  } else {
    data.comments = meta.comments === true
    // Link records are maintained in the existing Links section, independently of page copy.
  }
  let body = normalizeMarkdown(markdown.replace(text, '').trim(), !!string('migrationRevision'))
  if (body.startsWith(`# ${title}\n`)) body = body.slice(title.length + 3).trimStart()
  return {
    id: doc.id,
    title,
    file,
    path: target,
    body,
    data,
    draft: meta.draft === true,
    migrationRevision: string('migrationRevision'),
  }
}

export function isContentFile(file: string): boolean {
  return (
    /^(?:en\/)?(?:blog|pages)\/.+\.md$/.test(file) &&
    !file.includes('\\') &&
    !/[\p{Cc}]/u.test(file) &&
    file
      .split('/')
      .every((segment) => segment && !segment.startsWith('.') && !segment.endsWith('.'))
  )
}

export function serializeDocument(doc: BlogDocument): string {
  return serializeFile(
    doc.data,
    `\n${doc.body}\n`,
    doc.file.includes('blog/') ? POST_KEY_ORDER : PAGE_KEY_ORDER,
  )
}
