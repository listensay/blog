import type { AiAction } from '@/types'
import { codeBlockList, isLanguageLabelLine, proseOnly } from '@/utils/fences'
import { collectImageSrcs } from '@/utils/markdown'

export interface AiActionMeta {
  action: AiAction
  label: string
  hint: string
  wholeOnly: boolean
}

export const AI_ACTIONS: AiActionMeta[] = [
  { action: 'fix', label: '修复格式', hint: '仅调整 Markdown 标记，不改动文字', wholeOnly: true },
  { action: 'polish', label: '润色', hint: '理顺语句、修正错别字，信息不增不减', wholeOnly: false },
  { action: 'condense', label: '精简', hint: '压缩至约七成篇幅，信息不减少', wholeOnly: false },
  { action: 'expand', label: '扩写', hint: '补充解释与前提，不新增事实', wholeOnly: false },
  {
    action: 'meta',
    label: '生成标题 / slug / 摘要 / 标签',
    hint: '读取全文，填写右侧四个字段',
    wholeOnly: true,
  },
]

export const actionLabel = (action: AiAction): string =>
  AI_ACTIONS.find((a) => a.action === action)?.label ?? action

function headingLevels(prose: string): number[] {
  return [...prose.matchAll(/^ {0,3}(#{1,6})[ \t]/gm)].map((m) => m[1]!.length)
}

function linkHrefs(prose: string): string[] {
  return [...prose.matchAll(/(?<!!)\[[^\]]*\]\(\s*([^)\s]+)/g)].map((m) => m[1]!)
}

export interface IntegrityIssue {
  level: 'error' | 'warn'
  label: string
  detail: string
}

export function proseText(markdown: string): string {
  return proseOnly(markdown)
    .split('\n')
    .filter((line) => !isLanguageLabelLine(line))
    .join('\n')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]*>[ \t]*/gm, '')
    .replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/gm, '')
    .replace(/^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/gm, '')
    .replace(/^[ \t]*\|?[ \t:|-]+\|[ \t:|-]*$/gm, '')
    .replace(/`+/g, '')
    .replace(/[*_~]{1,3}/g, '')
    .replace(/\|/g, '')
    .replace(/\\([^a-zA-Z0-9])/g, '$1')
    .replace(/\\$/gm, '')
    .replace(/\s+/g, '')
}

function firstDifference(a: string, b: string): string {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1
  const around = (s: string) => s.slice(Math.max(0, i - 12), i + 24)
  return `原文「…${around(a)}…」→ 结果「…${around(b)}…」`
}

function diffMultiset(before: string[], after: string[]): { lost: string[]; gained: string[] } {
  const pool = new Map<string, number>()
  for (const item of before) pool.set(item, (pool.get(item) ?? 0) + 1)

  const gained: string[] = []
  for (const item of after) {
    const left = pool.get(item) ?? 0
    if (left > 0) pool.set(item, left - 1)
    else gained.push(item)
  }

  const lost: string[] = []
  for (const [item, count] of pool) {
    for (let n = 0; n < count; n += 1) lost.push(item)
  }

  return { lost, gained }
}

const sample = (items: string[], max = 3): string => {
  const head = items.slice(0, max).map((i) => `\`${i.length > 60 ? `${i.slice(0, 60)}…` : i}\``)
  return items.length > max ? `${head.join('、')} 等 ${items.length} 处` : head.join('、')
}

export function checkMarkdownIntegrity(
  before: string,
  after: string,
  options: { proseMustMatch?: boolean; headingLevelsMayChange?: boolean } = {},
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = []

  const images = diffMultiset(collectImageSrcs(before), collectImageSrcs(after))
  if (images.lost.length || images.gained.length) {
    const parts: string[] = []
    if (images.lost.length) parts.push(`少了 ${sample(images.lost)}`)
    if (images.gained.length) parts.push(`多了 ${sample(images.gained)}`)
    issues.push({
      level: 'error',
      label: '图片地址被改动',
      detail: `${parts.join('；')}。建议放弃本次结果，或在「结果」标签中手动修正。`,
    })
  }

  const beforeBlocks = codeBlockList(before)
  const afterBlocks = codeBlockList(after)
  const codeOf = (block: { body: string; raw: string }) =>
    options.headingLevelsMayChange ? block.body : block.raw

  const beforeProse = proseOnly(before)
  const afterProse = proseOnly(after)

  if (beforeBlocks.length !== afterBlocks.length) {
    issues.push({
      level: 'error',
      label: '代码块数量变了',
      detail: `原文 ${beforeBlocks.length} 个，结果 ${afterBlocks.length} 个。可能是模型把整段结果包进围栏了，也可能吃掉了一个代码块。`,
    })
  } else {
    const changed = beforeBlocks.filter(
      (block, i) => codeOf(block) !== codeOf(afterBlocks[i]!),
    ).length
    if (changed) {
      issues.push({
        level: 'error',
        label: '代码块内容被改',
        detail: `有 ${changed} 个代码块和原文不一致。代码是不该被改的，请在「结果」标签里改回来再用。`,
      })
    }
  }

  const beforeHeadings = headingLevels(beforeProse)
  const afterHeadings = headingLevels(afterProse)

  if (options.headingLevelsMayChange) {
    if (beforeHeadings.length !== afterHeadings.length) {
      issues.push({
        level: 'error',
        label: '标题数量变了',
        detail: `原文 ${beforeHeadings.length} 个标题，结果 ${afterHeadings.length} 个。格式修复不该增删标题，也不该把段落变成标题。`,
      })
    }
  } else if (beforeHeadings.join(',') !== afterHeadings.join(',')) {
    issues.push({
      level: 'error',
      label: '标题结构变了',
      detail:
        beforeHeadings.length === afterHeadings.length
          ? `标题数量没变但层级变了（原来 ${beforeHeadings.map((l) => '#'.repeat(l)).join(' ')}，现在 ${afterHeadings.map((l) => '#'.repeat(l)).join(' ')}）。`
          : `原文 ${beforeHeadings.length} 个标题，结果 ${afterHeadings.length} 个。文章目录会跟着变。`,
    })
  }

  if (options.proseMustMatch) {
    const beforeWords = proseText(before)
    const afterWords = proseText(after)
    if (beforeWords !== afterWords) {
      const delta = afterWords.length - beforeWords.length
      issues.push({
        level: 'error',
        label: '文字被改动（不只是格式）',
        detail:
          `修复格式不应改动文字，但正文发生了变化` +
          `（${beforeWords.length} → ${afterWords.length} 字，${delta > 0 ? '增加' : '减少'} ${Math.abs(delta)} 字）。` +
          `第一处差异：${firstDifference(beforeWords, afterWords)}。` +
          `建议放弃本次结果，或在「结果」标签中手动修正。`,
      })
    }
  }

  const links = diffMultiset(linkHrefs(beforeProse), linkHrefs(afterProse))
  if (links.lost.length || links.gained.length) {
    const parts: string[] = []
    if (links.lost.length) parts.push(`少了 ${sample(links.lost)}`)
    if (links.gained.length) parts.push(`多了 ${sample(links.gained)}`)
    issues.push({ level: 'warn', label: '链接地址有变动', detail: `${parts.join('；')}。` })
  }

  return issues
}

export interface DiffRow {
  kind: 'same' | 'add' | 'del' | 'skip'
  text: string
}

const DIFF_LINE_LIMIT = 1500

export function diffLines(before: string, after: string): DiffRow[] | null {
  const a = before.split('\n')
  const b = after.split('\n')
  if (a.length > DIFF_LINE_LIMIT || b.length > DIFF_LINE_LIMIT) return null

  const n = a.length
  const m = b.length

  const width = m + 1
  const lcs = new Uint32Array((n + 1) * width)
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i * width + j] =
        a[i] === b[j]
          ? lcs[(i + 1) * width + j + 1]! + 1
          : Math.max(lcs[(i + 1) * width + j]!, lcs[i * width + j + 1]!)
    }
  }

  const rows: DiffRow[] = []
  let i = 0
  let j = 0

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ kind: 'same', text: a[i]! })
      i += 1
      j += 1
    } else if (lcs[(i + 1) * width + j]! >= lcs[i * width + j + 1]!) {
      rows.push({ kind: 'del', text: a[i]! })
      i += 1
    } else {
      rows.push({ kind: 'add', text: b[j]! })
      j += 1
    }
  }
  while (i < n) rows.push({ kind: 'del', text: a[i++]! })
  while (j < m) rows.push({ kind: 'add', text: b[j++]! })

  return rows
}

export function collapseDiff(rows: DiffRow[], context = 2): DiffRow[] {
  const keep = Array.from({ length: rows.length }, () => false)

  rows.forEach((row, index) => {
    if (row.kind === 'same') return
    for (let i = index - context; i <= index + context; i += 1) {
      if (i >= 0 && i < rows.length) keep[i] = true
    }
  })

  const out: DiffRow[] = []
  let skipped = 0

  const flush = () => {
    if (!skipped) return
    out.push({ kind: 'skip', text: `⋯ 省略 ${skipped} 行没有变化的内容` })
    skipped = 0
  }

  rows.forEach((row, index) => {
    if (keep[index]) {
      flush()
      out.push(row)
    } else {
      skipped += 1
    }
  })
  flush()

  return out
}

export const changedRowCount = (rows: DiffRow[]): number =>
  rows.filter((r) => r.kind === 'add' || r.kind === 'del').length

export function unwrapSingleParagraph(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const children = [...doc.body.children]
  const only = children[0]

  if (children.length !== 1 || !only || only.tagName !== 'P') return html
  return only.innerHTML
}

export function replaceBodyKeepEdges(oldBody: string, next: string): string {
  const lead = /^[\r\n]*/.exec(oldBody)?.[0] ?? '\n'
  return `${lead}${next.trim()}\n`
}
