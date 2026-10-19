import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import type { Workspace } from '../paths.ts'
import { badRequest } from '../http.ts'
import { stateDir } from '../affine/config.ts'
import { contentFiles, safeContentPath } from '../affine/sync.ts'
import { splitFrontmatter } from '../frontmatter.ts'
import { readProjects } from '../projects.ts'
import { isJournalDate } from '../affine/document.ts'
import { WorkspaceStorage } from './storage.ts'
import { markdownForImport } from './import.ts'
import {
  bindFile,
  isEnglishBinding,
  chineseMetadata,
  bindingKey,
  metadataFor,
  publicationStatus,
  publish,
  type Binding,
} from './publish.ts'

export class LocalAffineService {
  readonly storage: WorkspaceStorage
  private controllers = new Map<string, AbortController>()
  readonly ws: Workspace
  readonly env: Record<string, string>
  constructor(ws: Workspace, env: Record<string, string> = {}) {
    this.ws = ws
    this.env = env
    this.storage = new WorkspaceStorage(path.join(stateDir(ws), 'workspace.sqlite'))
  }
  async status() {
    const built = await stat(path.join(this.ws.blogRoot, '.affine/web/index.html')).catch(
      () => null,
    )
    return {
      ready: !!built,
      mode: 'source',
      source: 'vendor/affine',
      version: '0.27.4',
      documents: this.storage.all<Binding>('blog-bindings').filter(b => !isEnglishBinding(b)).length,
    }
  }
  async invoke(command: unknown, args: Record<string, unknown>): Promise<unknown> {
    const workspaceId = typeof args.workspaceId === 'string' ? args.workspaceId : ''
    const docId = typeof args.docId === 'string' ? args.docId : ''
    switch (command) {
      case 'notes_storage_boot':
        return { enabled: true, importing: false }
      case 'notes_storage_abort':
      case 'notes_storage_commit':
        return null
      case 'notes_store_request':
        return this.storage.request(args.request)
      case 'blog_seed': {
        if (!workspaceId) throw badRequest('工作区标识无效')
        const owner = this.storage.get<string>('blog', 'workspace')
        if (owner && owner !== workspaceId) return []
        const contentSeeded = this.storage.get<boolean>('blog', 'seeded') === true
        const projectsSeeded = this.storage.get<boolean>('blog', 'projects_seeded') === true
        const journalsSeeded = this.storage.get<boolean>('blog', 'journals_seeded') === true
        if (contentSeeded && projectsSeeded && journalsSeeded) return []
        this.storage.set('blog', 'workspace', workspaceId)
        const bound = new Set(this.storage.all<Binding>('blog-bindings').map((b) => b.file))
        const entries = []
        if (!contentSeeded || !journalsSeeded) {
          for (const file of await contentFiles(this.ws)) {
            const journal = /^journals\//.test(file)
            if (journal ? journalsSeeded : contentSeeded) continue
            if (bound.has(file)) continue
            const raw = await readFile(await safeContentPath(this.ws, file), 'utf8')
            const { data, body } = splitFrontmatter(raw)
            entries.push({
              file,
              title: String(data.title ?? file),
              markdown: markdownForImport(body),
              ...(journal ? { journalDate: path.posix.basename(file, '.md') } : {}),
            })
          }
        }
        if (!projectsSeeded) {
          const { items: projects } = await readProjects(this.ws)
          for (const project of projects) {
            const file = `projects/${project.id}`
            if (bound.has(file)) continue
            entries.push({
              file,
              title: project.title,
              markdown: markdownForImport(project.description || project.title),
            })
          }
        }
        return entries
      }
      case 'blog_bind': {
        if (!workspaceId || !docId || typeof args.file !== 'string')
          throw badRequest('文档绑定无效')
        return bindFile(this.ws, this.storage, workspaceId, docId, args.file)
      }
      case 'blog_seed_done': {
        if (this.storage.get<string>('blog', 'workspace') === workspaceId) {
          this.storage.set('blog', 'seeded', true)
          this.storage.set('blog', 'projects_seeded', true)
          this.storage.set('blog', 'journals_seeded', true)
        }
        return null
      }
      case 'blog_find':
        return this.storage.all<Binding>('blog-bindings').find((b) => b.file === args.file && !isEnglishBinding(b)) ?? null
      case 'blog_retired_documents':
        if (!workspaceId) throw badRequest('工作区标识无效')
        return this.storage.all<Binding>('blog-bindings')
          .filter(binding => binding.workspaceId === workspaceId && isEnglishBinding(binding))
          .map(binding => binding.docId)
      case 'blog_documents':
        if (!workspaceId) throw badRequest('工作区标识无效')
        return this.storage
          .all<Binding>('blog-bindings')
          .filter((binding) => binding.workspaceId === workspaceId && !isEnglishBinding(binding))
          .map((binding) => ({
            docId: binding.docId,
            kind: binding.metadata.kind,
            ...(binding.metadata.kind === 'post'
              ? {
                  category:
                    typeof binding.metadata.category === 'string'
                      ? binding.metadata.category.trim() || '未分类'
                      : '未分类',
                }
              : {}),
          }))
      case 'blog_metadata': {
        const binding = this.storage.get<Binding>('blog-bindings', bindingKey(workspaceId, docId))
        if (isEnglishBinding(binding)) throw badRequest('英文内容已移除，无法再次发布')
        return (
          (binding ? chineseMetadata(binding.metadata) : null) ??
          (isJournalDate(args.journalDate)
            ? metadataFor(`journals/${args.journalDate}.md`, { date: args.journalDate })
            : metadataFor('blog/article.md', { slug: '', date: new Date().toISOString().slice(0, 10) }))
        )
      }
      case 'blog_publication_status':
        return publicationStatus(this.storage, workspaceId, docId, args.journalDate)
      case 'blog_publish':
        return publish(this.ws, this.storage, args)
      case 'affine_ai_request':
        return this.ai(args)
      case 'affine_ai_cancel':
        this.controllers.get(String(args.id))?.abort()
        return null
      default:
        throw badRequest('未知工作区请求')
    }
  }
  private async ai(args: Record<string, unknown>) {
    const key = this.env.AFFINE_AI_API_KEY || process.env.AFFINE_AI_API_KEY
    const model = this.env.AFFINE_AI_MODEL || process.env.AFFINE_AI_MODEL
    const base =
      this.env.AFFINE_AI_BASE_URL || process.env.AFFINE_AI_BASE_URL || 'https://api.openai.com/v1'
    if (!key || !model)
      throw badRequest(
        '请先在 admin/.env.local 设置 AFFINE_AI_API_KEY 和 AFFINE_AI_MODEL，然后重启后台',
      )
    if (
      typeof args.prompt !== 'string' ||
      !Array.isArray(args.messages) ||
      args.messages.length > 40
    )
      throw badRequest('AI 请求无效')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 120000)
    this.controllers.set(String(args.id), controller)
    try {
      const response = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: args.prompt },
            ...args.messages.map((m) => ({
              role: m.role,
              content:
                Array.isArray(m.images) && m.images.length
                  ? [
                      { type: 'text', text: m.content },
                      ...m.images.map((image: { mediaType: string; data: string }) => ({
                        type: 'image_url',
                        image_url: { url: `data:${image.mediaType};base64,${image.data}` },
                      })),
                    ]
                  : m.content,
            })),
          ],
        }),
      })
      if (!response.ok) {
        await response.body?.cancel()
        throw new Error(`AI 服务请求失败（HTTP ${response.status}）`)
      }
      const result = (await response.json()) as { choices?: { message?: { content?: string } }[] }
      const text = result.choices?.[0]?.message?.content
      if (!text) throw new Error('AI 服务未返回文字')
      return text
    } finally {
      clearTimeout(timer)
      this.controllers.delete(String(args.id))
    }
  }
  stop() {
    for (const controller of this.controllers.values()) controller.abort()
    this.storage.close()
  }
}
