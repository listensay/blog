const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/
const FENCE_CLOSE_ONLY = /^ {0,3}(?:`{3,}|~{3,})\s*$/

export interface MdLine {
  text: string
  inCode: boolean
  opensFence: boolean
  closesFence: boolean
  info: string
}

export function scanLines(markdown: string): MdLine[] {
  const out: MdLine[] = []

  let fence = ''

  for (const text of markdown.split('\n')) {
    const matched = FENCE_OPEN.exec(text)

    if (!fence) {
      if (matched) {
        fence = matched[1] ?? ''
        out.push({
          text,
          inCode: true,
          opensFence: true,
          closesFence: false,
          info: (matched[2] ?? '').trim(),
        })
      } else {
        out.push({ text, inCode: false, opensFence: false, closesFence: false, info: '' })
      }
      continue
    }

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

export const CODE_LANGUAGES = new Set([
  'bash',
  'sh',
  'shell',
  'zsh',
  'fish',
  'console',
  'terminal',
  'cmd',
  'bat',
  'powershell',
  'ps1',
  'python',
  'py',
  'javascript',
  'js',
  'typescript',
  'ts',
  'jsx',
  'tsx',
  'vue',
  'svelte',
  'json',
  'json5',
  'yaml',
  'yml',
  'toml',
  'ini',
  'xml',
  'html',
  'css',
  'scss',
  'less',
  'sql',
  'graphql',
  'go',
  'golang',
  'rust',
  'java',
  'kotlin',
  'swift',
  'c',
  'cpp',
  'c++',
  'csharp',
  'cs',
  'php',
  'ruby',
  'rb',
  'perl',
  'lua',
  'r',
  'matlab',
  'dart',
  'scala',
  'dockerfile',
  'docker',
  'nginx',
  'apache',
  'makefile',
  'cmake',
  'diff',
  'patch',
  'markdown',
  'md',
  'text',
  'plaintext',
  'txt',
  'log',
  'env',
  'gitignore',
  'vim',
])

export function isLanguageLabelLine(line: string): boolean {
  const body = line.replace(/^[\s>]*/, '').trim()
  return body !== '' && CODE_LANGUAGES.has(body.toLowerCase())
}

export interface CodeBlock {
  info: string
  body: string
  raw: string
}

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
    if (!line.closesFence) body?.push(line.text)
    if (line.closesFence) flush()
  }

  flush()
  return blocks
}

export function codeBlocks(markdown: string): string[] {
  return codeBlockList(markdown).map((block) => block.raw)
}

export function proseOnly(markdown: string): string {
  return scanLines(markdown)
    .filter((line) => !line.inCode)
    .map((line) => line.text)
    .join('\n')
}
