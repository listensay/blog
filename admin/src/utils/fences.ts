// Markdown 的逐行围栏扫描，「这一行在不在代码块里」只在这里判一次，别抄第二遍。
// 收尾围栏必须同种字符且不短于开头，没闭合的围栏一路算到文末 —— 错一次上层就拿错误的边界去比对。

/** 一行是不是围栏的开头（``` 或 ~~~，允许最多三个前导空格）。四空格缩进的代码块不算 */
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
  /** 开启围栏那一行的信息串（通常是语言名）。只有 `opensFence` 为真时有意义，空串表示没写语言 */
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

// 常见的代码块语言名：「修复格式」要把孤零零一行 `Bash` 合进围栏，`proseText` 要把这种行排除掉。
// 只认白名单，免得把正文里一个普通词当成语言标签。
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

// 每个围栏代码块，按出现顺序；没闭合的围栏也算一块，否则「原文少一块、结果多一块」会互相抵消。
// 分 body / raw 是因为校验有两种严格程度：改写类比 raw（连语言名都不该动），格式修复只能比 body。
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
