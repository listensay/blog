// 顶部菜单的读写，数据在 `content/data/nav.json`，站点侧 import 成 `siteConfig.nav`
// 校验比文章那边严：每个页面都会渲染它，一条坏数据就是整站顶栏出问题
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { NavIconOption, NavItem, NavResponse } from '../src/types.ts'
import { badRequest } from './http.ts'
import { type Workspace, ensureDir } from './paths.ts'

// 能选的图标，label 是给下拉用的中文说明
// 必须和 `app/utils/site.ts` 的 NAV_ICONS 一字不差（连顺序），`npm run check` 里有用例比对
export const NAV_ICONS: NavIconOption[] = [
  { value: 'home', label: '首页' },
  { value: 'articles', label: '文章' },
  { value: 'categories', label: '分类' },
  { value: 'tags', label: '标签' },
  { value: 'about', label: '关于（人像）' },
  { value: 'links', label: '友链（链条）' },
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

/** 颜色只收 `#rrggbb`：站点侧的兜底只认六位十六进制，别的写法会被换成灰色 */
const COLOR_RE = /^#[0-9a-fA-F]{6}$/

/** 一条菜单的文字上限，再长手机上那条滑动轨道就没法用了 */
const MAX_LABEL = 24
/** 菜单项上限，防手滑 */
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

  if (!label) throw badRequest(`${at}没写文字`)
  if (label.length > MAX_LABEL) throw badRequest(`${at}的文字太长了（最多 ${MAX_LABEL} 个字）`)
  if (!to) throw badRequest(`${at}（${label}）没写路径`)
  // 只收站内路径：外链匹配不上「当前页高亮」，而且点一下就把人带出站了
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

  // 路径不能重复：两项指向同一个地址时「当前页」会同时高亮两个
  const seen = new Set<string>()
  for (const item of items) {
    if (seen.has(item.to)) throw badRequest(`有两项都指向 ${item.to}，留一个就好`)
    seen.add(item.to)
  }

  return items
}

/** 读菜单。文件不存在时返回空列表，界面上提示「保存一次就会建出来」 */
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
      // 手改坏了（JSON 语法错之类）不报 500，界面要能打开并让人重新保存一份
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

/** 一项一行（不是每个键一行）：换顺序时 git diff 才看得懂 */
function stringifyNav(items: NavItem[]): string {
  if (!items.length) return '[]\n'
  const lines = items.map((item) => {
    const pairs = Object.entries(item).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    return `  { ${pairs.join(', ')} }`
  })
  return `[\n${lines.join(',\n')}\n]\n`
}

/** 写菜单。校验不过一个字都不落盘 */
export async function writeNav(ws: Workspace, input: unknown): Promise<NavResponse> {
  const items = validate(input)

  ensureDir(path.dirname(ws.navFile))
  await writeFile(ws.navFile, stringifyNav(items), 'utf8')

  return { items, icons: NAV_ICONS, file: navFileLabel(ws) }
}

/** 界面上显示的相对路径，如 `content/data/nav.json` */
function navFileLabel(ws: Workspace): string {
  return path.relative(ws.blogRoot, ws.navFile).split(path.sep).join('/')
}
