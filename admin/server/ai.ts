import type { AiMetaResult, AiRequest, AiResult, AiStatus, AiUsage } from '../src/types.ts'
import { HttpError, badRequest } from './http.ts'
import { SLUG_RE } from './posts.ts'

export interface AiConfig {
  baseUrl: string
  apiKey: string
  model: string
  timeoutMs: number
  maxTokens: number
}

const DEFAULT_MODEL = 'gpt-4o-mini'
const DEFAULT_BASE_URL = 'https://api.openai.com/v1'

const DEFAULT_TIMEOUT_MS = 300_000

const TEXT_LIMIT = 60_000

export function resolveAiConfig(env: Record<string, string | undefined>): AiConfig {
  const number = (value: string | undefined, fallback: number) => {
    const parsed = Number(value?.trim())
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
  }

  return {
    baseUrl: (env.ADMIN_AI_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    apiKey: env.ADMIN_AI_API_KEY?.trim() ?? '',
    model: env.ADMIN_AI_MODEL?.trim() || DEFAULT_MODEL,
    timeoutMs: number(env.ADMIN_AI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    maxTokens: number(env.ADMIN_AI_MAX_TOKENS, 0),
  }
}

export function aiStatus(config: AiConfig): AiStatus {
  return {
    enabled: !!config.apiKey,
    model: config.model,
    baseUrl: config.baseUrl,
    hint: config.apiKey
      ? ''
      : '还没配 AI：在 admin/.env.local 里写上 ADMIN_AI_API_KEY（可选 ADMIN_AI_BASE_URL、ADMIN_AI_MODEL），然后重启 dev server。可以照 admin/.env.example 抄。',
  }
}

function rulesFor(action: AiRequest['action']): string {
  const heading =
    action === 'fix'
      ? '4. 不许增删标题。标题的**文字**一个字都不许改；只有层级（前面几个 `#`）可以按上面第 1 条调整。'
      : '4. 不许增删标题，也不许改标题层级。原文有几个 `##` 就还是几个 `##`，顺序也不变。'

  return [
    '铁律，违反任何一条这次就算失败：',
    '1. 只输出处理后的 Markdown 正文本身。不要开场白、不要结尾总结、不要「好的，以下是」这类话，也不要把整段结果包进 ``` 围栏里（除非原文本身就是一整个代码块）。',
    '2. 代码块（``` 围栏、缩进代码）和行内代码里的字符一个都不许动，连注释、空行、拼写错误都保持原样。',
    '3. 图片和链接的地址（圆括号里那部分）一个字符都不许动，尤其不要「修正」`../../../public/images/x.png` 这种相对路径 —— 它是对的。',
    heading,
    '5. 原始 HTML 标签、脚注、数学公式这些非 Markdown 的结构原样保留。',
    '6. 保留原文的段落划分、列表结构和表格结构。列表不要改成段落，段落也不要改成列表。',
    '7. 用简体中文。技术名词和专有名词（API、Nuxt、slug、Cloudflare 之类）保持英文原样，不要翻译。',
    '8. 中文和英文、数字之间留一个空格；中文用全角标点，代码和纯英文里用半角标点。',
  ].join('\n')
}

interface ActionSpec {
  label: string
  temperature: number
  task: string
}

const ACTIONS: Record<Exclude<AiRequest['action'], 'meta'>, ActionSpec> = {
  fix: {
    label: '修复格式',
    temperature: 0,
    task: [
      '下面这段中文技术博客正文是从 AI 对话、网页或者 Word 里粘过来的：**文字内容是对的，Markdown 格式很脏**。',
      '你的任务是把格式修好。',
      '',
      '**最重要的一条：只改格式，一个字都不许改文字。**',
      '读者读到的每一句话、每个词、每个标点都必须和原文完全一样。你只动 Markdown 标记本身。',
      '不许润色、不许改写、不许合并或拆分句子、不许增删任何内容 —— 哪怕你觉得某句话写得不好。',
      '',
      '要修的（按常见程度排）：',
      '1. **标题层级**：整篇的标题必须**从 `##` 开始**。文章页已经把标题渲染成 h1 了，正文再出现 `#` 就是重复的一级标题。',
      '   保持相对层级不变地整体上提或下压（`###`/`####`/`####` → `##`/`###`/`###`），跳级（`##` 直接到 `####`）要接上。',
      '   不许增删标题，也不许把普通段落变成标题、或者把标题变成段落。',
      '2. **多余的转义反斜杠**：`**1\\. 更新软件源**` → `**1. 更新软件源**`。',
      '   但**行首**的 `1\\.`、`\\#`、`\\-`、`\\+`、`\\>` 必须留着 —— 去掉转义会凭空长出一个列表或标题。',
      '   `\\*`、`` \\` ``、表格里的 `\\|` 也一律留着（会变成强调、行内代码、劈开单元格）。',
      '3. **代码块上面孤零零一行语言名**（Bash、Python、JSON 这种，是从网页上的语言徽标粘进来的）：',
      '   合进围栏写成 ```bash，那一行删掉。围栏本来就写了语言的，不要改。',
      '4. **清垃圾**：单独一行的反斜杠、行尾多余空格、代码围栏旁边多出来的空引用行（`>`）、三行以上的连续空行。',
      '   注意夹在**两段引用之间**的空 `>` 是段落分隔符，要留着，删了两段会并成一段。',
      '5. **列表、表格、引用**的缩进和标记规范化（`|a|b|` → `| a | b |`，列表标记统一用 `-`）。',
      '6. 中文和英文、数字之间补一个空格 —— 只在明显缺失的地方补，代码和链接里的不要动。',
    ].join('\n'),
  },

  polish: {
    label: '润色',
    temperature: 0.3,
    task: [
      '把下面这段中文技术博客正文改得更通顺：修掉错别字、语病、机翻腔和口水话，把过长的句子拆短，让人一遍就读懂。',
      '不许增加原文没有的信息，也不许删掉任何一条信息 —— 只改怎么说，不改说了什么。',
      '改完的篇幅和原文相差不超过一成。',
    ].join('\n'),
  },

  condense: {
    label: '精简',
    temperature: 0.3,
    task: [
      '把下面这段中文技术博客正文压缩得更紧：删掉冗余、重复、铺垫和「值得注意的是」这类空话，长句拆短。',
      '信息量必须一条都不少，只是说得更省 —— 每一个事实、结论、注意事项都要还在。',
      '目标篇幅是原文的六到七成。',
    ].join('\n'),
  },

  expand: {
    label: '扩写',
    temperature: 0.6,
    task: [
      '在下面这段中文技术博客正文原有的骨架上补充内容：把一句话带过的地方讲清楚，补上前提条件、为什么这么做、以及读者容易踩的坑。',
      '**不许编造事实**：版本号、性能数字、API 名称、命令行参数、配置项这些一律不许自己发明。不确定的地方就别写，宁可少写。',
      '目标篇幅是原文的一点三到一点六倍。',
    ].join('\n'),
  },
}

const SCOPE_NOTE: Record<AiRequest['scope'], string> = {
  selection: [
    '注意：给你的是整篇文章里的**一小段**，不是全文。',
    '所以不要补开头的引入句、不要加结尾总结、不要加标题 —— 改完的结果要能原位放回文章里，前后文自然接上。',
    '如果这段是从一句话中间截出来的，就保持它是个片段，不要硬凑成完整句子。',
  ].join('\n'),
  all: '给你的是这篇文章的全部正文（frontmatter 已经摘掉了，不用管它）。',
}

const META_PROMPT = [
  '读完下面这篇中文技术博客，产出它的标题、URL slug、摘要和标签。',
  '',
  '只输出一个 JSON 对象，不要任何解释，不要包进 ``` 围栏：',
  '{"title": "…", "slug": "…", "description": "…", "tags": ["…", "…"]}',
  '',
  'title：中文标题，20 个汉字以内，说清这篇讲什么。',
  '  不要「详解」「一文搞懂」「全网最全」「手把手」这类标题党词，也不要加副标题。',
  '  技术名词保持英文原样大小写。',
  '  **如果我给你的现有标题已经够好，就原样把它返回**，不要为了显得有改动而硬改。',
  '',
  'slug：文章 URL 里用的英文短名，比如 `free-ai-proxy-list`。',
  '  - 只能用小写英文字母、数字和连字符 `-`。不许出现中文、空格、下划线、斜杠、点、大写字母。',
  '  - 2 到 5 个词，短而看得懂。不要用 the / a / of / how-to 这类虚词凑长度。',
  '  - 中文标题要**意译成地道英文**，绝对不要用拼音。',
  '    「免费AI公益中转站收集分享」→ `free-ai-proxy-list`（不是 `mianfei-ai-zhongzhuanzhan`）。',
  '    「简单破解Jetbrains全家桶」→ `crack-jetbrains-ide`。',
  '  - 技术名词用通用小写写法：nuxt、python、cloudflare、rlhf、docker。',
  '',
  'description：一句话说清这篇文章讲了什么、读者看完能得到什么。40 到 80 个汉字。',
  '  不要用「本文介绍了」「这篇文章」开头，直接说事。结尾不加句号。',
  '',
  'tags：3 到 6 个，每个 2 到 8 个字符。',
  '  优先用文章里真的出现过的技术名词，英文的保持英文原样大小写（Nuxt、Python、API）。',
  '  不要造词，也不要「技术」「分享」「记录」这种贴在任何文章上都成立的词 —— 除非这篇确实就是一篇教程，那 tags 里可以有「教程」。',
].join('\n')

interface ChatChoice {
  message?: { content?: unknown }
  finish_reason?: unknown
}

interface ChatResponse {
  choices?: ChatChoice[]
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown }
  error?: { message?: unknown }
}

function explainFailure(status: number, body: string): HttpError {
  let detail = body.slice(0, 300)
  try {
    const parsed = JSON.parse(body) as ChatResponse
    if (parsed.error?.message) detail = String(parsed.error.message)
  } catch {}

  const reason: Record<number, string> = {
    401: '密钥不对或者过期了（ADMIN_AI_API_KEY）',
    403: '这个密钥没有访问权限',
    404: 'ADMIN_AI_BASE_URL 或 ADMIN_AI_MODEL 不对，接口路径找不到',
    429: '请求过于频繁，请稍后重试',
  }

  const prefix = reason[status] ?? `AI 接口返回 HTTP ${status}`
  return new HttpError(status === 429 ? 429 : 502, `${prefix}。接口原话：${detail}`)
}

async function chat(
  config: AiConfig,
  system: string,
  user: string,
  temperature: number,
): Promise<{ text: string; usage: AiUsage | null; truncated: boolean }> {
  const body: Record<string, unknown> = {
    model: config.model,
    temperature,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  }
  if (config.maxTokens) body.max_tokens = config.maxTokens

  let response: Response
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.timeoutMs),
    })
  } catch (err) {
    const name = err instanceof Error ? err.name : ''
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new HttpError(
        504,
        `AI 接口 ${Math.round(config.timeoutMs / 1000)} 秒没回话。文章很长的话可以只选一段来改，或者把 ADMIN_AI_TIMEOUT_MS 调大。`,
      )
    }
    throw new HttpError(
      502,
      `AI 接口连接失败 ${config.baseUrl}：${err instanceof Error ? err.message : String(err)}`,
    )
  }

  const raw = await response.text()
  if (!response.ok) throw explainFailure(response.status, raw)

  let data: ChatResponse
  try {
    data = JSON.parse(raw) as ChatResponse
  } catch {
    throw new HttpError(502, `AI 接口返回的不是 JSON：${raw.slice(0, 200)}`)
  }

  const choice = data.choices?.[0]
  const content = choice?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new HttpError(502, `AI 没给出内容。接口原话：${raw.slice(0, 300)}`)
  }

  const usage: AiUsage | null =
    typeof data.usage?.prompt_tokens === 'number' &&
    typeof data.usage?.completion_tokens === 'number'
      ? { prompt: data.usage.prompt_tokens, completion: data.usage.completion_tokens }
      : null

  return { text: content, usage, truncated: choice?.finish_reason === 'length' }
}

function stripWrappingFence(text: string): string {
  const trimmed = text.trim()
  const match = /^```[^\n]*\n([\s\S]*)\n```$/.exec(trimmed)
  if (!match) return trimmed

  const inner = match[1] ?? ''
  if (inner.includes('```')) return trimmed
  return inner.trim()
}

const LEAD_IN = /^(?:好的|以下是|这是|下面是)[^\n]{0,40}[:：]\s*\n+/

function cleanText(text: string): string {
  return stripWrappingFence(text).replace(LEAD_IN, '').trim()
}

const SLUG_TRIM = /^[\s\-_.,:;'"`<>()[\]{}/\\]+|[\s\-_.,:;'"`<>()[\]{}/\\]+$/g

const SLUG_MAX = 80

export function normalizeSlug(raw: unknown): string {
  if (typeof raw !== 'string') return ''

  const cleaned = raw
    .replace(SLUG_TRIM, '')
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')

  if (cleaned.length > SLUG_MAX) return ''
  return SLUG_RE.test(cleaned) ? cleaned : ''
}

function parseMeta(text: string): Omit<AiMetaResult, 'kind' | 'model' | 'usage'> {
  const cleaned = stripWrappingFence(text)
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end <= start) {
    throw new HttpError(502, `AI 没按 JSON 格式回话：${cleaned.slice(0, 200)}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    throw new HttpError(502, `AI 给的 JSON 解析不了：${cleaned.slice(start, start + 200)}`)
  }

  const object = (parsed ?? {}) as Record<string, unknown>
  const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

  const result = {
    title: str(object.title),
    slug: normalizeSlug(object.slug),
    description: str(object.description),
    tags: Array.isArray(object.tags)
      ? [
          ...new Set(
            object.tags
              .filter((t): t is string => typeof t === 'string')
              .map((t) => t.trim())
              .filter(Boolean),
          ),
        ].slice(0, 8)
      : [],
  }

  if (!result.title && !result.slug && !result.description && !result.tags.length) {
    throw new HttpError(
      502,
      `AI 给的 JSON 里四个字段都是空的：${cleaned.slice(start, start + 200)}`,
    )
  }

  return result
}

const VALID_ACTIONS = new Set<AiRequest['action']>(['fix', 'polish', 'condense', 'expand', 'meta'])

const LEGACY_ACTIONS: Record<string, AiRequest['action']> = { summarize: 'meta' }

function contextLine(input: AiRequest): string {
  const parts: string[] = []
  if (input.title?.trim()) parts.push(`文章标题《${input.title.trim()}》`)
  if (input.category?.trim()) parts.push(`分类「${input.category.trim()}」`)
  return parts.length ? `${parts.join('，')}。\n\n` : ''
}

export async function runAi(config: AiConfig, request: AiRequest): Promise<AiResult> {
  if (!config.apiKey) {
    throw new HttpError(503, aiStatus(config).hint)
  }

  const action = LEGACY_ACTIONS[request.action as string] ?? request.action
  const input: AiRequest = { ...request, action }

  if (!VALID_ACTIONS.has(action)) {
    throw badRequest(
      `不支持的 AI 动作：${String(request.action)}。` +
        `可用动作：${[...VALID_ACTIONS].join(' / ')}。` +
        `若页面长时间未刷新，请刷新后重试。`,
    )
  }

  const text = typeof input.text === 'string' ? input.text : ''
  const title = input.title?.trim() ?? ''

  if (!text.trim() && !(input.action === 'meta' && title)) {
    throw badRequest(input.action === 'meta' ? '正文和标题都是空的' : '没有要处理的内容')
  }
  if (text.length > TEXT_LIMIT) {
    throw badRequest(
      `这段有 ${text.length} 字，超过单次上限 ${TEXT_LIMIT} 字。选一部分来改，或者分几次做。`,
    )
  }

  if (input.action === 'meta') {
    const { text: raw, usage } = await chat(
      config,
      META_PROMPT,
      `${contextLine(input)}${text}`,
      0.2,
    )
    return { kind: 'meta', ...parseMeta(raw), model: config.model, usage }
  }

  const spec = ACTIONS[input.action]

  const scope: AiRequest['scope'] =
    input.action === 'fix' ? 'all' : input.scope === 'selection' ? 'selection' : 'all'

  const system = `${spec.task}\n\n${SCOPE_NOTE[scope]}\n\n${rulesFor(input.action)}`

  const {
    text: raw,
    usage,
    truncated,
  } = await chat(config, system, `${contextLine(input)}${text}`, spec.temperature)

  return { kind: 'text', text: cleanText(raw), model: config.model, usage, truncated }
}
