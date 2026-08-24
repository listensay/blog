/**
 * Markdown 的逐行围栏扫描。**判断「这一行在不在代码块里」这件事只在这里做一次。**
 *
 * 为什么单独一个文件：`utils/ai.ts` 的完整性校验要靠它切出代码块和纯正文，
 * 而它有两个很容易写错的地方 ——
 *
 *  1. **收尾围栏必须和开头同种字符、且不短于开头。** 原文用 ```` 包住一段含 ``` 的代码时，
 *     里面那个 ``` 不是结束。写错的后果是把后面的正文当成代码（或者反过来）。
 *  2. **没闭合的围栏**要一路算到文末，不能当它不存在。
 *
 * 这两条错一次，上层就会拿错误的边界去比对，而且症状很隐蔽。以后再有别的地方
 * 需要「这行是不是代码」，一律 import 这里，别抄第二遍。
 *
 * 刻意不处理缩进代码块（四个空格）：Markdown 里它和列表续行没法在行级别上区分，
 * 真要分清得整棵语法树。这个仓库的文章用的都是围栏。
 */

/** 一行是不是围栏的开头（``` 或 ~~~，允许最多三个前导空格） */
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/
/** 收尾围栏那一行**只有**围栏，后面不能跟别的东西 */
const FENCE_CLOSE_ONLY = /^ {0,3}(?:`{3,}|~{3,})\s*$/

export interface MdLine {
  text: string
  /** 在围栏代码块里面 —— **包括围栏那两行本身** */
  inCode: boolean
  /** 这一行是开启围栏 */
  opensFence: boolean
  /** 这一行是收尾围栏 */
  closesFence: boolean
  /**
   * 开启围栏那一行的信息串（``` 后面那截，通常是语言名）。
   * 只有 `opensFence` 为真时有意义；空串表示没写语言。
   */
  info: string
}

/** 把 Markdown 切成带围栏标记的行。行数和 `markdown.split('\n')` 一一对应 */
export function scanLines(markdown: string): MdLine[] {
  const out: MdLine[] = []

  /** 当前开着的围栏字符串（``` 或 ~~~~ 等）。空串表示不在代码块里 */
  let fence = ''

  for (const text of markdown.split('\n')) {
    const matched = FENCE_OPEN.exec(text)

    if (!fence) {
      if (matched) {
        fence = matched[1] ?? ''
        out.push({ text, inCode: true, opensFence: true, closesFence: false, info: (matched[2] ?? '').trim() })
      } else {
        out.push({ text, inCode: false, opensFence: false, closesFence: false, info: '' })
      }
      continue
    }

    // 同一种字符、不短于开头那串，而且这一行只有围栏 → 收尾
    const closes =
      !!matched &&
      matched[1]![0] === fence[0] &&
      matched[1]!.length >= fence.length &&
      FENCE_CLOSE_ONLY.test(text)

    out.push({ text, inCode: true, opensFence: false, closesFence: closes, info: '' })
    if (closes) fence = ''
  }

  return out
}

/**
 * 常见的代码块语言名。两处用到：
 *
 *  - 「修复格式」要把代码块上面孤零零一行 `Bash` 合进围栏，那一行就是这些词之一；
 *  - `proseText` 要把这种标签行排除掉，否则「标签被合进围栏」会被误判成「文字被删了」。
 *
 * 只认白名单，免得把正文里一个普通词当成语言标签。
 */
export const CODE_LANGUAGES = new Set([
  'bash', 'sh', 'shell', 'zsh', 'fish', 'console', 'terminal', 'cmd', 'bat', 'powershell', 'ps1',
  'python', 'py', 'javascript', 'js', 'typescript', 'ts', 'jsx', 'tsx', 'vue', 'svelte',
  'json', 'json5', 'yaml', 'yml', 'toml', 'ini', 'xml', 'html', 'css', 'scss', 'less',
  'sql', 'graphql', 'go', 'golang', 'rust', 'java', 'kotlin', 'swift', 'c', 'cpp', 'c++',
  'csharp', 'cs', 'php', 'ruby', 'rb', 'perl', 'lua', 'r', 'matlab', 'dart', 'scala',
  'dockerfile', 'docker', 'nginx', 'apache', 'makefile', 'cmake', 'diff', 'patch',
  'markdown', 'md', 'text', 'plaintext', 'txt', 'log', 'env', 'gitignore', 'vim',
])

/** 一整行是不是只有一个语言名（前后允许空白和引用记号） */
export function isLanguageLabelLine(line: string): boolean {
  const body = line.replace(/^[\s>]*/, '').trim()
  return body !== '' && CODE_LANGUAGES.has(body.toLowerCase())
}

export interface CodeBlock {
  /** 围栏后面那截信息串，通常是语言名 */
  info: string
  /** 围栏之间的内容，**不含**围栏那两行 */
  body: string
  /** 整块原文，含围栏行 */
  raw: string
}

/**
 * 每个围栏代码块，按出现顺序。没闭合的围栏也算一块 ——
 * 否则「原文少一块、结果多一块」会互相抵消，看不出来。
 *
 * 分成 `body` 和 `raw` 是有用的：判断「代码被改了没」有两种严格程度 ——
 * 改写类动作连围栏上的语言名都不该动（比 `raw`），
 * 而「修复格式」的活里就包括给围栏补语言名（只能比 `body`）。
 */
export function codeBlockList(markdown: string): CodeBlock[] {
  const blocks: CodeBlock[] = []
  let raw: string[] | null = null
  let body: string[] | null = null
  let info = ''

  const flush = () => {
    if (!raw) return
    blocks.push({ info, body: (body ?? []).join('\n'), raw: raw.join('\n') })
    raw = null
    body = null
    info = ''
  }

  for (const line of scanLines(markdown)) {
    if (!line.inCode) {
      flush()
      continue
    }
    if (line.opensFence) {
      flush()
      raw = [line.text]
      body = []
      info = line.info
      continue
    }
    raw?.push(line.text)
    // 收尾围栏不算内容
    if (!line.closesFence) body?.push(line.text)
    if (line.closesFence) flush()
  }

  flush()
  return blocks
}

/** 每个围栏代码块的完整原文（含围栏行），按出现顺序 */
export function codeBlocks(markdown: string): string[] {
  return codeBlockList(markdown).map((block) => block.raw)
}

/** 去掉代码块之后剩下的正文，用来找标题和链接（免得把代码里的 # 当标题） */
export function proseOnly(markdown: string): string {
  return scanLines(markdown)
    .filter((line) => !line.inCode)
    .map((line) => line.text)
    .join('\n')
}
