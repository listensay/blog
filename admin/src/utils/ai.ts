/**
 * AI 结果的前端处理：**先验，再看，才敢用**。
 *
 * 这个文件里没有一行是在调 AI（那在 server/ai.ts）。它做的全是拿到结果之后的事：
 *
 *  1. `checkMarkdownIntegrity` —— 逐项比对改写前后的图片地址、代码块、标题层级、链接。
 *     提示词里已经写死了「这些不许动」，但模型该犯的错还是会犯，而这个仓库里
 *     改错一个图片路径的后果是**线上 404 而本地一切正常**（blog 构建期只有一行 warn）。
 *     所以提示词只是第一道防线，这里是第二道，最后一道是人眼看对比。
 *
 *  2. `diffLines` —— 行级 LCS 差异。不引 diff 库：真正想看清的是「结构有没有被动」，
 *     标题、代码块、图片这些都独占一行，行级差异刚好把它们显示成「没变」，
 *     一眼就能看出模型有没有守规矩。中文句子内部的字词级差异反而是噪音。
 */
import type { AiAction } from '@/types'
import { codeBlockList, isLanguageLabelLine, proseOnly } from '@/utils/fences'
import { collectImageSrcs } from '@/utils/markdown'

/* ------------------------------------------------------------------ 动作元信息 */

export interface AiActionMeta {
  action: AiAction
  label: string
  hint: string
  /** 只能对全文做 —— 摘要和标签是整篇文章的属性，改一段没有意义 */
  wholeOnly: boolean
}

export const AI_ACTIONS: AiActionMeta[] = [
  { action: 'fix', label: '修复格式', hint: '只改 Markdown 标记，一个字都不改', wholeOnly: true },
  { action: 'polish', label: '润色', hint: '改通顺、修错别字，信息不增不减', wholeOnly: false },
  { action: 'condense', label: '精简', hint: '压到六七成篇幅，信息一条不少', wholeOnly: false },
  { action: 'expand', label: '扩写', hint: '补解释、前提和坑，不编事实', wholeOnly: false },
  {
    action: 'meta',
    label: '生成标题 / slug / 摘要 / 标签',
    hint: '读全文，填右边表单的四个字段',
    wholeOnly: true,
  },
]

export const actionLabel = (action: AiAction): string =>
  AI_ACTIONS.find((a) => a.action === action)?.label ?? action

/* -------------------------------------------------------------- 代码块与结构提取 */

/** 标题层级序列，如 `[2, 3, 3, 2]` */
function headingLevels(prose: string): number[] {
  return [...prose.matchAll(/^ {0,3}(#{1,6})[ \t]/gm)].map((m) => m[1]!.length)
}

/** 链接地址（不含图片 —— 图片单独比，因为它更要紧） */
function linkHrefs(prose: string): string[] {
  return [...prose.matchAll(/(?<!!)\[[^\]]*\]\(\s*([^)\s]+)/g)].map((m) => m[1]!)
}

/* ---------------------------------------------------------------- 完整性校验 */

export interface IntegrityIssue {
  /** error = 别用这个结果；warn = 看一眼确认是你想要的 */
  level: 'error' | 'warn'
  label: string
  detail: string
}

/**
 * 剥掉 Markdown 标记，只留「读者真正读到的文字」，而且**去掉所有空白**。
 *
 * 给「格式修复」用：那个动作只许改标记、不许改文字，所以修完这个值必须一模一样。
 * 去掉空白是刻意的 —— 补中英文之间的空格、重排缩进、换行位置都属于格式改动，
 * 不该被当成「文字变了」；而增删一个词一定会让这个值变。
 *
 * 代码块整块排除（那里面的内容由另一条校验逐块比对，比这个严格得多）。
 */
export function proseText(markdown: string): string {
  return (
    proseOnly(markdown)
      .split('\n')
      /*
       * 整行只有一个语言名（`Bash`）的行去掉。「修复格式」的活之一就是把这种标签
       * 合进围栏、删掉那一行 —— 不排除的话，它干对了反而会被判成「文字被删了」。
       */
      .filter((line) => !isLanguageLabelLine(line))
      .join('\n')
      // 图片整个去掉（alt 允许改），链接只留可见文字
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // 行首的块标记：标题、引用、列表
      .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
      .replace(/^[ \t]*>[ \t]*/gm, '')
      .replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/gm, '')
      // 分割线、表格分隔行（整行去掉）
      .replace(/^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/gm, '')
      .replace(/^[ \t]*\|?[ \t:|-]+\|[ \t:|-]*$/gm, '')
      // 行内标记
      .replace(/`+/g, '')
      .replace(/[*_~]{1,3}/g, '')
      .replace(/\|/g, '')
      // 转义反斜杠：`1\.` 和 `1.` 在读者眼里是同一个字符
      .replace(/\\([^a-zA-Z0-9])/g, '$1')
      // 行尾硬换行的两种写法
      .replace(/\\$/gm, '')
      // 最后去掉所有空白
      .replace(/\s+/g, '')
  )
}

/** 两段文字第一处不一样的地方，前后各截一点给人看 */
function firstDifference(a: string, b: string): string {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1
  const around = (s: string) => s.slice(Math.max(0, i - 12), i + 24)
  return `原文「…${around(a)}…」→ 结果「…${around(b)}…」`
}

/** 多重集合比较：返回「少了的」和「多出来的」 */
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

/** 列几个例子，别把整篇都糊到提示里 */
const sample = (items: string[], max = 3): string => {
  const head = items.slice(0, max).map((i) => `\`${i.length > 60 ? `${i.slice(0, 60)}…` : i}\``)
  return items.length > max ? `${head.join('、')} 等 ${items.length} 处` : head.join('、')
}

/**
 * 改写前后比一遍，把「模型动了不该动的东西」列出来。
 *
 * error 级的都是**会让线上出问题或者悄悄改坏文章**的：图片 404、代码被改、目录层级乱、
 * 文字被偷偷润色。warn 级的是「可能是你要的，但确认一下」。
 *
 * `options.proseMustMatch` 给「格式修复」用：那个动作只许改 Markdown 标记，
 * 所以读者读到的文字必须一字不差。
 * `options.headingLevelsMayChange` 也是给它用的 —— 调层级正是它的活。
 */
export function checkMarkdownIntegrity(
  before: string,
  after: string,
  options: { proseMustMatch?: boolean; headingLevelsMayChange?: boolean } = {},
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = []

  // ---- 图片地址：这个仓库里最脆弱的东西
  const images = diffMultiset(collectImageSrcs(before), collectImageSrcs(after))
  if (images.lost.length || images.gained.length) {
    const parts: string[] = []
    if (images.lost.length) parts.push(`少了 ${sample(images.lost)}`)
    if (images.gained.length) parts.push(`多了 ${sample(images.gained)}`)
    issues.push({
      level: 'error',
      label: '图片地址被改动',
      detail: `${parts.join('；')}。相对路径改错了本地预览照样有图，但线上会 404 —— 建议弃用这个结果，或者在「结果」标签里手动改回来。`,
    })
  }

  /*
   * ---- 代码块：里面的代码一个字符都不该变。
   *
   * 严格程度看动作：改写类动作连围栏上的语言名都不该动（比整块原文），
   * 而「修复格式」的活里就**包括**给没写语言的围栏补上语言名，
   * 所以那种情况只比围栏之间的内容。不分开的话，它干对了反而报错。
   */
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
    const changed = beforeBlocks.filter((block, i) => codeOf(block) !== codeOf(afterBlocks[i]!)).length
    if (changed) {
      issues.push({
        level: 'error',
        label: '代码块内容被改',
        detail: `有 ${changed} 个代码块和原文不一致。代码是不该被改的，请在「结果」标签里改回来再用。`,
      })
    }
  }

  // ---- 标题：改写类动作连层级都不该动；格式修复只查数量（调层级正是它的活）
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

  // ---- 正文文字：格式修复的头号红线 —— 模型最容易「顺手」润色一句
  if (options.proseMustMatch) {
    const beforeWords = proseText(before)
    const afterWords = proseText(after)
    if (beforeWords !== afterWords) {
      const delta = afterWords.length - beforeWords.length
      issues.push({
        level: 'error',
        label: '文字被改动了（不只是格式）',
        detail:
          `修复格式本来应该一个字都不改，但读者读到的文字变了` +
          `（${beforeWords.length} → ${afterWords.length} 字，${delta > 0 ? '多' : '少'}了 ${Math.abs(delta)} 个）。` +
          `第一处不同：${firstDifference(beforeWords, afterWords)}。` +
          `建议在「结果」标签里改回来，或者干脆别用这次结果。`,
      })
    }
  }

  // ---- 链接：换了地址不一定是错，但得看一眼
  const links = diffMultiset(linkHrefs(beforeProse), linkHrefs(afterProse))
  if (links.lost.length || links.gained.length) {
    const parts: string[] = []
    if (links.lost.length) parts.push(`少了 ${sample(links.lost)}`)
    if (links.gained.length) parts.push(`多了 ${sample(links.gained)}`)
    issues.push({ level: 'warn', label: '链接地址有变动', detail: `${parts.join('；')}。` })
  }

  return issues
}

/* ------------------------------------------------------------------ 行级差异 */

export interface DiffRow {
  kind: 'same' | 'add' | 'del' | 'skip'
  text: string
}

/**
 * 超过这个行数就不算差异了。LCS 是 O(n·m)，两千行就是四百万格 ——
 * 算得出来，但要等，而且这么长的差异人也看不过来，不如直接看两份原文。
 */
const DIFF_LINE_LIMIT = 1500

/** 行级 LCS 差异。太长时返回 null，调用方改成并排显示原文 */
export function diffLines(before: string, after: string): DiffRow[] | null {
  const a = before.split('\n')
  const b = after.split('\n')
  if (a.length > DIFF_LINE_LIMIT || b.length > DIFF_LINE_LIMIT) return null

  const n = a.length
  const m = b.length

  // 从后往前填的 LCS 长度表。Uint32Array 而不是嵌套数组：1500×1500 也只有 9MB
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
      // 删除排在新增前面，同一处改动读起来是「原来这样 → 现在这样」
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

/** 把大段没变的内容折成一行「省略 N 行」，只在改动附近留几行上下文 */
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

/* ---------------------------------------------------------------- 插回编辑器 */

/**
 * `mdToHtml` 一定会把内容包成块级元素（一段文字 → `<p>…</p>`）。
 * 但**行内选区**（在一个段落中间选了半句话）要插回去的是行内内容 ——
 * 带着 `<p>` 插进去会把那个段落劈成三段，正文结构就被改了。
 *
 * 所以：整份 HTML 恰好只有一个 `<p>` 时，把它拆掉只留里面的内容；
 * 其余情况（结果里有列表、标题、多段）原样返回，让它按块级插入。
 */
export function unwrapSingleParagraph(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const children = [...doc.body.children]
  const only = children[0]

  if (children.length !== 1 || !only || only.tagName !== 'P') return html
  return only.innerHTML
}

/** 用新正文替换旧正文，但保留旧正文开头的空行和结尾的换行 */
export function replaceBodyKeepEdges(oldBody: string, next: string): string {
  // 文件里 frontmatter 之后通常空一行，那个空行属于「文件长什么样」，不该被 AI 顺手抹掉
  const lead = /^[\r\n]*/.exec(oldBody)?.[0] ?? '\n'
  return `${lead}${next.trim()}\n`
}
