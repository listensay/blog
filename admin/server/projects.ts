import { createHash, randomUUID } from 'node:crypto'
import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { Project, ProjectsResponse } from '../../app/types/project.ts'
import { badRequest, conflict } from './http.ts'
import { ensureDir, type Workspace } from './paths.ts'

const labels: Record<string, string> = {
  id: '作品标识',
  title: '作品名称',
  titleEn: '英文名称',
  description: '简介',
  descriptionEn: '英文简介',
  cover: '封面',
  demoUrl: '演示链接',
  repoUrl: '源码链接',
}

function text(item: Record<string, unknown>, key: string, max: number): string {
  const value = item[key]
  if (value === undefined) return ''
  if (typeof value !== 'string') throw badRequest(`${labels[key]}必须是文字`)
  if (value.trim().length > max) throw badRequest(`${labels[key]}最多 ${max} 个字符`)
  return value.trim()
}

function url(item: Record<string, unknown>, key: string): string {
  const value = text(item, key, 2048)
  if (!value) return ''
  if (/[\s\\\u0000-\u001f\u007f]/.test(value)) throw badRequest(`${labels[key]}不是有效的网址`)
  if (value.startsWith('/') && !value.startsWith('//')) return value
  try {
    const parsed = new URL(value)
    if (
      ['https:', 'http:'].includes(parsed.protocol) &&
      parsed.hostname &&
      !parsed.username &&
      !parsed.password
    ) {
      return value
    }
  } catch {
    /* Report a readable validation error below. */
  }
  throw badRequest(`${labels[key]}请填写 http(s) 链接或以 / 开头的站内地址`)
}

function validate(input: unknown): Project[] {
  if (!Array.isArray(input) || input.length > 500) throw badRequest('作品必须是数组，最多 500 个')
  const ids = new Set<string>()
  return input.map((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw badRequest(`第 ${index + 1} 个作品格式不正确`)
    const item = value as Record<string, unknown>
    const id = text(item, 'id', 80)
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw badRequest('作品标识不合法')
    if (ids.has(id)) throw badRequest('作品标识重复，请刷新后重试')
    ids.add(id)
    const title = text(item, 'title', 100)
    if (!title) throw badRequest(`第 ${index + 1} 个作品的名称不能为空`)
    if (typeof item.draft !== 'boolean') throw badRequest('作品的草稿状态必须是布尔值')
    if (
      !Array.isArray(item.tags) ||
      item.tags.length > 20 ||
      item.tags.some((tag) => typeof tag !== 'string' || !tag.trim() || tag.trim().length > 40)
    ) {
      throw badRequest('技术标签最多 20 个，每个标签为 1–40 个字符')
    }
    return {
      id,
      title,
      titleEn: text(item, 'titleEn', 100),
      description: text(item, 'description', 1000),
      descriptionEn: text(item, 'descriptionEn', 1000),
      cover: url(item, 'cover'),
      tags: [...new Set((item.tags as string[]).map((tag) => tag.trim()))],
      demoUrl: url(item, 'demoUrl'),
      repoUrl: url(item, 'repoUrl'),
      draft: item.draft,
    }
  })
}

const fileOf = (ws: Workspace) => path.join(ws.contentDir, 'data', 'projects.json')
const revisionOf = (raw: string) => createHash('sha256').update(raw).digest('hex')

async function readState(ws: Workspace) {
  let raw: string
  try {
    raw = await readFile(fileOf(ws), 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    return { raw: '', items: [] as Project[], revision: revisionOf('') }
  }
  let items: Project[]
  try {
    items = validate(JSON.parse(raw))
  } catch (err) {
    throw badRequest(
      `作品文件无法读取，请先修复 content/data/projects.json：${err instanceof Error ? err.message : err}`,
    )
  }
  return { raw, items, revision: revisionOf(raw) }
}

export async function readProjects(ws: Workspace): Promise<ProjectsResponse> {
  const { items, revision } = await readState(ws)
  return { items, revision }
}

// Serialize writes so two browser tabs cannot both pass the revision check.
const pendingWrites = new Map<string, Promise<unknown>>()

export async function writeProjects(ws: Workspace, input: unknown): Promise<ProjectsResponse> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw badRequest('作品保存参数不正确')
  const payload = input as Record<string, unknown>
  const items = validate(payload.items)
  if (typeof payload.revision !== 'string') throw badRequest('缺少作品版本，请刷新后重试')
  const file = fileOf(ws)
  const previous = pendingWrites.get(file) ?? Promise.resolve()
  const operation = previous
    .catch(() => {})
    .then(async () => {
      const current = await readState(ws)
      if (current.revision !== payload.revision)
        throw conflict('作品已在其他窗口修改，请刷新后重新编辑')
      const raw = `${JSON.stringify(items, null, 2)}\n`
      if (current.raw === raw) return { items, revision: current.revision }
      const ids = new Set(items.map((item) => item.id))
      if (current.items.some((item) => !ids.has(item.id))) {
        ensureDir(ws.trashDir)
        await writeFile(
          path.join(ws.trashDir, `projects__${Date.now()}_${randomUUID()}.json`),
          current.raw,
          { flag: 'wx' },
        )
      }
      ensureDir(path.dirname(file))
      const temporary = path.join(path.dirname(file), `.projects-${randomUUID()}.tmp`)
      try {
        await writeFile(temporary, raw, { flag: 'wx' })
        await rename(temporary, file)
      } finally {
        await rm(temporary, { force: true })
      }
      return { items, revision: revisionOf(raw) }
    })
  pendingWrites.set(file, operation)
  try {
    return await operation
  } finally {
    if (pendingWrites.get(file) === operation) pendingWrites.delete(file)
  }
}
