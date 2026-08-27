import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { NavIconOption, NavItem, NavResponse } from '../src/types.ts'
import { badRequest } from './http.ts'
import { type Workspace, ensureDir } from './paths.ts'

export const NAV_ICONS: NavIconOption[] = [
  { value: 'home', label: '首页' },
  { value: 'articles', label: '文章' },
  { value: 'categories', label: '分类' },
  { value: 'tags', label: '标签' },
  { value: 'about', label: '关于' },
  { value: 'links', label: '友链' },
  { value: 'page', label: '文档' },
  { value: 'book', label: '书' },
  { value: 'star', label: '星星' },
  { value: 'heart', label: '心' },
  { value: 'mail', label: '邮件' },
  { value: 'message', label: '留言' },
  { value: 'photo', label: '照片' },
  { value: 'code', label: '代码' },
  { value: 'rss', label: 'RSS' },
  { value: 'world', label: '地球' },
  { value: 'sparkles', label: '闪光' },
  { value: 'coffee', label: '咖啡' },
  { value: 'terminal', label: '终端' },
  { value: 'archive', label: '归档' },
]

const ICON_VALUES = new Set(NAV_ICONS.map((item) => item.value))

const COLOR_RE = /^#[0-9a-fA-F]{6}$/

const MAX_LABEL = 24
const MAX_ITEMS = 20

function asItem(value: unknown, index: number): NavItem {
  const at = `第 ${index + 1} 项`
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw badRequest(`${at}不是一个菜单项`)
  }

  const item = value as Record<string, unknown>
  const label = typeof item.label === 'string' ? item.label.trim() : ''
  const to = typeof item.to === 'string' ? item.to.trim() : ''
  const icon = typeof item.icon === 'string' ? item.icon.trim() : ''
  const color = typeof item.color === 'string' ? item.color.trim() : ''

  if (!label) throw badRequest(`${at}的名称不能为空`)
  if (label.length > MAX_LABEL) throw badRequest(`${at}的文字太长了（最多 ${MAX_LABEL} 个字）`)
  if (!to) throw badRequest(`${at}（${label}）的路径不能为空`)
  if (!to.startsWith('/')) {
    throw badRequest(`${at}（${label}）的路径要以 / 开头，顶栏只放站内页面：${to}`)
  }
  if (!ICON_VALUES.has(icon)) throw badRequest(`${at}（${label}）的图标不认识：${icon || '（空）'}`)
  if (!COLOR_RE.test(color)) {
    throw badRequest(`${at}（${label}）的颜色要写成 #rrggbb：${color || '（空）'}`)
  }

  return { label, to, icon, color }
}

function validate(input: unknown): NavItem[] {
  if (!Array.isArray(input)) throw badRequest('菜单要是一个数组')
  if (input.length > MAX_ITEMS) throw badRequest(`菜单项最多 ${MAX_ITEMS} 个`)

  const items = input.map(asItem)

  const seen = new Set<string>()
  for (const item of items) {
    if (seen.has(item.to)) throw badRequest(`有两项都指向 ${item.to}，请删除重复项`)
    seen.add(item.to)
  }

  return items
}

export async function readNav(ws: Workspace): Promise<NavResponse> {
  let items: NavItem[] = []
  let missing = false

  try {
    const raw = await readFile(ws.navFile, 'utf8')
    items = validate(JSON.parse(raw) as unknown)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      missing = true
    } else {
      return {
        items: [],
        icons: NAV_ICONS,
        file: navFileLabel(ws),
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  return { items, icons: NAV_ICONS, file: navFileLabel(ws), missing }
}

function stringifyNav(items: NavItem[]): string {
  if (!items.length) return '[]\n'
  const lines = items.map((item) => {
    const pairs = Object.entries(item).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    return `  { ${pairs.join(', ')} }`
  })
  return `[\n${lines.join(',\n')}\n]\n`
}

export async function writeNav(ws: Workspace, input: unknown): Promise<NavResponse> {
  const items = validate(input)

  ensureDir(path.dirname(ws.navFile))
  await writeFile(ws.navFile, stringifyNav(items), 'utf8')

  return { items, icons: NAV_ICONS, file: navFileLabel(ws) }
}

function navFileLabel(ws: Workspace): string {
  return path.relative(ws.blogRoot, ws.navFile).split(path.sep).join('/')
}
