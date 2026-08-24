/**
 * 本地接口的端到端检查：真的起一个 Vite dev server，用 fetch 走一遍增删改。
 *
 * 跑法：`npm run check`。
 *
 * 关键点：**不碰真仓库**。脚本会把 `content/` 和 `public/` 复制到临时目录，
 * 通过 `ADMIN_BLOG_ROOT` 让接口指向那份副本，所以随便怎么增删改都影响不到你的文章。
 */
import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const adminRoot = path.resolve(import.meta.dirname, '..')
const realBlogRoot = process.env.ADMIN_BLOG_ROOT
  ? path.resolve(process.env.ADMIN_BLOG_ROOT)
  : path.resolve(adminRoot, '..')

let failures = 0
const pass = (msg: string) => console.log(`  ✓ ${msg}`)
const fail = (msg: string) => {
  failures += 1
  console.log(`  ✗ ${msg}`)
}

/** 断言包一层，一条失败不影响后面的用例继续跑 */
async function check(label: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    pass(label)
  } catch (err) {
    fail(`${label}\n      ${err instanceof Error ? err.message.split('\n').join('\n      ') : err}`)
  }
}

// ------------------------------------------------------- 造一份仓库副本再起服务
const sandbox = await mkdtemp(path.join(tmpdir(), 'blog-admin-check-'))
console.log(`\n临时仓库：${sandbox}（真仓库不会被改）`)

await cp(path.join(realBlogRoot, 'content'), path.join(sandbox, 'content'), { recursive: true })
await cp(path.join(realBlogRoot, 'public'), path.join(sandbox, 'public'), { recursive: true })

process.env.ADMIN_BLOG_ROOT = sandbox

const { createServer } = await import('vite')
const server = await createServer({
  root: adminRoot,
  configFile: path.join(adminRoot, 'vite.config.ts'),
  logLevel: 'warn',
  server: { port: 0, host: '127.0.0.1' },
})
await server.listen()

const address = server.httpServer?.address()
const port = typeof address === 'object' && address ? address.port : 0
const base = `http://127.0.0.1:${port}`
console.log(`接口地址：${base}\n`)

type Json = Record<string, unknown>

async function call(
  method: string,
  url: string,
  body?: unknown,
): Promise<{ status: number; data: Json }> {
  const init: RequestInit = { method }
  if (body !== undefined) {
    init.headers = { 'content-type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  const response = await fetch(`${base}${url}`, init)
  const text = await response.text()
  return { status: response.status, data: text ? (JSON.parse(text) as Json) : {} }
}

const createdTrash: string[] = []

try {
  // ------------------------------------------------------------------ 读
  console.log('读')

  let firstFile = ''

  await check('GET /api/workspace 报告仓库路径和数量', async () => {
    const { status, data } = await call('GET', '/api/workspace')
    assert.equal(status, 200)
    assert.equal(data.blogRoot, sandbox)
    assert.ok((data.postCount as number) >= 1, `文章数是 ${data.postCount}`)
  })

  await check('GET /api/posts 列出文章，附带分类/标签/目录候选', async () => {
    const { status, data } = await call('GET', '/api/posts')
    assert.equal(status, 200)
    const posts = data.posts as Array<Json>
    assert.ok(posts.length >= 1)
    assert.ok(Array.isArray(data.categories))
    assert.ok(Array.isArray(data.dirs))
    firstFile = String(posts[0]!.file)
    // 列表按日期倒序
    const dates = posts.map((p) => String(p.date))
    assert.deepEqual(dates, [...dates].sort().reverse())
  })

  await check('GET /api/post 读出正文和 frontmatter', async () => {
    const { status, data } = await call('GET', `/api/post?file=${encodeURIComponent(firstFile)}`)
    assert.equal(status, 200)
    assert.equal(data.file, firstFile)
    assert.equal(typeof data.body, 'string')
    assert.equal(typeof data.title, 'string')
  })

  // ------------------------------------------------------- 打开不改再存，逐字节相同
  console.log('\n打开不改、原样保存')

  const { data: allPosts } = await call('GET', '/api/posts')
  for (const summary of allPosts.posts as Array<Json>) {
    const file = String(summary.file)
    await check(`${file} 保存后逐字节相同`, async () => {
      const absolute = path.join(sandbox, 'content', file)
      const before = await readFile(absolute, 'utf8')

      const { data: detail } = await call('GET', `/api/post?file=${encodeURIComponent(file)}`)
      const { status } = await call('PUT', `/api/post?file=${encodeURIComponent(file)}`, detail)
      assert.equal(status, 200)

      const after = await readFile(absolute, 'utf8')
      assert.equal(after, before, '文件内容变了')
    })
  }

  // ------------------------------------------------------------------ 增改删
  console.log('\n增 / 改 / 删')

  const draft = {
    dir: 'ai',
    name: '接口自测文章',
    title: '接口自测文章',
    description: '这是 npm run check 造出来的',
    date: '2026-08-21 14:05',
    slug: 'api-check-post',
    path: '',
    category: '测试',
    tags: ['自测', 'admin'],
    draft: true,
    cover: '',
    body: '\n正文一段。\n\n![](../../../public/images/x.png)\n',
  }

  let created = ''

  await check('POST /api/post 新建', async () => {
    const { status, data } = await call('POST', '/api/post', draft)
    assert.equal(status, 201)
    assert.equal(data.file, 'blog/ai/接口自测文章.md')
    assert.equal(data.realPath, '/blog/ai/api-check-post')
    assert.equal(data.draft, true)
    assert.equal(data.images, 1)
    created = String(data.file)

    const raw = await readFile(path.join(sandbox, 'content', created), 'utf8')
    assert.ok(raw.startsWith('---\ntitle: 接口自测文章\n'), `文件开头是 ${JSON.stringify(raw.slice(0, 40))}`)
    assert.ok(raw.includes('date: 2026-08-21 14:05'), '日期时间没按 YYYY-MM-DD HH:mm 落盘')
    assert.ok(raw.includes('draft: true'))
    assert.ok(!raw.includes('cover:'), '空 cover 不该写进文件')
    assert.ok(raw.endsWith('![](../../../public/images/x.png)\n'), '正文没原样写进去')
  })

  await check('同名再建一次 → 409', async () => {
    const { status, data } = await call('POST', '/api/post', draft)
    assert.equal(status, 409)
    assert.match(String(data.error), /已存在/)
  })

  await check('slug 撞车 → 409', async () => {
    const { status, data } = await call('POST', '/api/post', { ...draft, name: '另一个名字' })
    assert.equal(status, 409)
    assert.match(String(data.error), /slug/)
  })

  await check('PUT /api/post 改名换目录，旧文件被清掉', async () => {
    const { data: detail } = await call('GET', `/api/post?file=${encodeURIComponent(created)}`)
    const { status, data } = await call('PUT', `/api/post?file=${encodeURIComponent(created)}`, {
      ...detail,
      dir: 'docs',
      name: '接口自测文章-改名',
      draft: false,
      title: '改过的标题',
    })
    assert.equal(status, 200)
    assert.equal(data.file, 'blog/docs/接口自测文章-改名.md')

    const files = ((await call('GET', '/api/posts')).data.posts as Array<Json>).map((p) =>
      String(p.file),
    )
    assert.ok(!files.includes(created), '旧文件还在')
    assert.ok(files.includes('blog/docs/接口自测文章-改名.md'), '新文件不在列表里')

    const raw = await readFile(path.join(sandbox, 'content', String(data.file)), 'utf8')
    assert.ok(!raw.includes('draft:'), 'draft 取消后不该再写这个字段')
    created = String(data.file)
  })

  await check('DELETE /api/post 移到 admin/.trash/', async () => {
    const { status, data } = await call('DELETE', `/api/post?file=${encodeURIComponent(created)}`)
    assert.equal(status, 200)

    const trashed = String(data.trashed)
    createdTrash.push(trashed)
    const trashFiles = await readdir(path.join(adminRoot, '.trash'))
    assert.ok(trashFiles.includes(trashed), `.trash 里没有 ${trashed}`)
    assert.match(trashed, /docs__接口自测文章-改名\.md$/)

    const files = ((await call('GET', '/api/posts')).data.posts as Array<Json>).map((p) =>
      String(p.file),
    )
    assert.ok(!files.includes(created))
  })

  await check('再删一次 → 404', async () => {
    const { status } = await call('DELETE', `/api/post?file=${encodeURIComponent(created)}`)
    assert.equal(status, 404)
  })

  // ------------------------------------------------------------------ 校验
  console.log('\n入参校验')

  const invalid: Array<[string, Record<string, unknown>, number]> = [
    ['标题为空', { title: '   ' }, 400],
    ['slug 为空', { slug: '' }, 400],
    ['slug 带中文', { slug: '中文' }, 400],
    ['slug 带大写', { slug: 'Upper' }, 400],
    ['日期格式不对', { date: '2026/8/21' }, 400],
    ['日期不存在', { date: '2026-02-31' }, 400],
    ['小时越界', { date: '2026-08-21 25:00' }, 400],
    ['分钟越界', { date: '2026-08-21 12:60' }, 400],
    ['只有日期也接受（按 00:00）', { date: '2026-08-21', name: '只给日期', slug: 'date-only-ok' }, 201],
    ['文件名带斜杠', { name: 'a/b' }, 400],
    ['子目录想跳出去', { dir: '../../etc' }, 400],
  ]

  for (const [label, patch, expected] of invalid) {
    await check(`${label} → ${expected}`, async () => {
      const { status } = await call('POST', '/api/post', {
        ...draft,
        name: '校验用临时文章',
        slug: 'validate-temp',
        ...patch,
      })
      assert.equal(status, expected)
    })
  }

  console.log('\n路径穿越')

  const traversal = [
    ['读仓库外的文件', '../../.env'],
    ['读 pages 集合', 'pages/about.md'],
    ['绝对路径', '/etc/passwd'],
    ['非 md 文件', 'blog/x.txt'],
  ] as const

  for (const [label, file] of traversal) {
    await check(`${label} → 400`, async () => {
      const { status } = await call('GET', `/api/post?file=${encodeURIComponent(file)}`)
      assert.equal(status, 400)
    })
  }

  await check('不存在的接口 → 404', async () => {
    const { status } = await call('GET', '/api/nope')
    assert.equal(status, 404)
  })

  // ------------------------------------------------------------------ 图片
  console.log('\n图片')

  // 1x1 的 png
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
    'base64',
  )

  let uploadedName = ''

  await check('POST /api/images 上传，空格换成 -', async () => {
    const response = await fetch(`${base}/api/images?name=${encodeURIComponent('自测 图片.png')}`, {
      method: 'POST',
      body: new Uint8Array(png),
    })
    assert.equal(response.status, 201)
    const data = (await response.json()) as { image: { name: string }; reused: boolean }
    assert.equal(data.image.name, '自测-图片.png')
    assert.equal(data.reused, false)
    uploadedName = data.image.name
  })

  await check('同一张图再传一次 → 复用，不产生第二个文件', async () => {
    const response = await fetch(`${base}/api/images?name=${encodeURIComponent('自测 图片.png')}`, {
      method: 'POST',
      body: new Uint8Array(png),
    })
    const data = (await response.json()) as { image: { name: string }; reused: boolean }
    assert.equal(data.reused, true)
    assert.equal(data.image.name, uploadedName)
  })

  await check('非图片扩展名 → 400', async () => {
    const response = await fetch(`${base}/api/images?name=x.exe`, {
      method: 'POST',
      body: new Uint8Array(png),
    })
    assert.equal(response.status, 400)
  })

  await check('GET /api/images 能列出刚上传的图', async () => {
    const { status, data } = await call('GET', '/api/images')
    assert.equal(status, 200)
    const images = data.images as Array<Json>
    assert.ok(images.some((i) => i.name === uploadedName))
  })

  await check('/blog-public/ 能取到图片本体（编辑器预览靠它）', async () => {
    const response = await fetch(`${base}/blog-public/images/${encodeURIComponent(uploadedName)}`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'image/png')
    const bytes = Buffer.from(await response.arrayBuffer())
    assert.equal(bytes.length, png.length)
  })

  await check('/blog-public/ 不给 public 外面的东西', async () => {
    /*
     * 注意别用 `/blog-public/../content/x`：`..` 会被 URL 解析规范化掉（fetch 和
     * WHATWG URL 都会消掉 `..` 段，连 `%2e%2e` 也会先解码再消），请求最后打到的是
     * `/content/x`，根本进不了这个处理器 —— 那样测的其实是 Vite 的兜底路由。
     *
     * 真正能带着 `..` 抵达服务端的写法是把斜杠编码成 `%2f`：URL 解析不会解码它，
     * 于是 `..%2fx` 作为**一整个**路径段留下来，直到我们自己 decodeURIComponent。
     */
    for (const attack of [
      '..%2fcontent%2fcontent.config.ts',
      '%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      'images%2f..%2f..%2fcontent%2fcontent.config.ts',
    ]) {
      const response = await fetch(`${base}/blog-public/${attack}`)
      assert.ok([403, 404].includes(response.status), `${attack} 的状态码是 ${response.status}`)
      const body = await response.text()
      assert.ok(!body.includes('defineContentConfig'), `${attack} 把仓库文件读出来了`)
    }
  })
  // ------------------------------------------------- 老文章只写了日期时的行为
  console.log('\n只写了日期的老文章')
  {
    const file = 'blog/docs/只有日期的老文章.md'
    const absolute = path.join(sandbox, 'content', file)
    const legacy = [
      '---',
      'title: 只有日期的老文章',
      'description: 用来验证日期时间的兼容行为',
      'date: 2026-08-19',
      'slug: legacy-date-only',
      'category: Docs',
      '---',
      '',
      '正文。',
      '',
    ].join('\n')

    await check('读出来时按当天 00:00 显示', async () => {
      await writeFile(absolute, legacy, 'utf8')
      const { data } = await call('GET', `/api/post?file=${encodeURIComponent(file)}`)
      assert.equal(data.date, '2026-08-19 00:00')
    })

    await check('没动时间就保存 → 原来那行不被改写（仍然只有日期）', async () => {
      const { data: detail } = await call('GET', `/api/post?file=${encodeURIComponent(file)}`)
      const { status } = await call('PUT', `/api/post?file=${encodeURIComponent(file)}`, detail)
      assert.equal(status, 200)
      const after = await readFile(absolute, 'utf8')
      assert.equal(after, legacy, '文件被改写了')
    })

    await check('真的调了时间 → 写成 YYYY-MM-DD HH:mm', async () => {
      const { data: detail } = await call('GET', `/api/post?file=${encodeURIComponent(file)}`)
      const { status, data } = await call('PUT', `/api/post?file=${encodeURIComponent(file)}`, {
        ...detail,
        date: '2026-08-19 14:30',
      })
      assert.equal(status, 200)
      assert.equal(data.date, '2026-08-19 14:30')
      const after = await readFile(absolute, 'utf8')
      assert.ok(after.includes('date: 2026-08-19 14:30'), `落盘内容不对：${after.slice(0, 120)}`)
      assert.ok(!after.includes('date: 2026-08-19\n'), '旧的纯日期还在')
    })

    await check('带时区的写法按本地时间归一', async () => {
      await writeFile(absolute, legacy.replace('date: 2026-08-19', 'date: 2026-08-19T09:30:00+08:00'), 'utf8')
      const { data } = await call('GET', `/api/post?file=${encodeURIComponent(file)}`)
      // 沙箱和作者机器都是 Asia/Shanghai（+08），所以墙上时间就是 09:30
      assert.equal(data.date, '2026-08-19 09:30')
    })
  }

  // ------------------------------------------------------------------ AI
  console.log('\nAI')

  /*
   * 这里刻意**不**真的调模型：要花钱、要网络、结果还不确定，放进自检就等于
   * 每次跑 check 都赌一次。能确定的是接口的形状和入参校验，那才是这层的责任。
   *
   * 「配没配」必须问服务端自己（`GET /api/ai` 的 enabled），不能看 process.env ——
   * 密钥是 Vite 的 loadEnv 从 `.env.local` 读进来的，压根不在 process.env 里。
   * 早先版本就是看 process.env 判断的，结果作者配好 .env.local 之后，
   * 「没配密钥」那条用例反而**真的把请求发给模型了**。
   */
  const aiConfigured = ((await call('GET', '/api/ai')).data.enabled as boolean) === true

  await check('GET /api/ai 报告配置状态', async () => {
    const { status, data } = await call('GET', '/api/ai')
    assert.equal(status, 200)
    assert.equal(typeof data.enabled, 'boolean')
    assert.equal(typeof data.model, 'string')
    assert.ok(String(data.model).length > 0, 'model 是空的')
    // 密钥绝对不能出现在响应里
    assert.ok(!('apiKey' in data), '响应里带了 apiKey')
    assert.ok(!JSON.stringify(data).includes('sk-'), '响应里像是带了密钥')
  })

  /*
   * 下面这几条都是「在动网络之前就该被拒掉」的入参错误 —— runAi 里的顺序是
   * 密钥 → 动作名 → 内容长度 → 才 fetch，所以配了密钥也不会真的调模型。
   * 没配密钥时会更早地停在 503，两种都算对。
   */
  const rejected = (status: number) => [400, 503].includes(status)

  await check('不认识的动作 → 400', async () => {
    const { status } = await call('POST', '/api/ai', { action: '删掉全文', scope: 'all', text: 'x' })
    assert.ok(rejected(status), `状态码是 ${status}`)
  })

  await check('内容为空 → 400', async () => {
    const { status } = await call('POST', '/api/ai', { action: 'polish', scope: 'all', text: '  ' })
    assert.ok(rejected(status), `状态码是 ${status}`)
  })

  await check('meta：正文和标题都空 → 400', async () => {
    const { status, data } = await call('POST', '/api/ai', { action: 'meta', scope: 'all', text: '' })
    assert.ok(rejected(status), `状态码是 ${status}`)
    if (aiConfigured) assert.match(String(data.error), /正文和标题都是空的/)
  })

  await check('超过单次字数上限 → 400', async () => {
    const { status, data } = await call('POST', '/api/ai', {
      action: 'polish',
      scope: 'all',
      text: '字'.repeat(60_001),
    })
    if (aiConfigured) {
      assert.equal(status, 400)
      assert.match(String(data.error), /上限/)
    } else {
      assert.equal(status, 503)
    }
  })

  if (aiConfigured) {
    console.log('  · 这台机器配了 AI（.env.local），跳过「没配密钥」那条；仍然不会真的调模型')
  } else {
    await check('没配密钥时 → 503，并说清该设哪个变量', async () => {
      const { status, data } = await call('POST', '/api/ai', {
        action: 'polish',
        scope: 'all',
        text: '一段正文。',
      })
      assert.equal(status, 503)
      assert.match(String(data.error), /ADMIN_AI_API_KEY/)
    })
  }

  // ------------------------------------------------------------- 前端能否编译
  console.log('\n前端模块（走 dev server 的真实转换管线）')

  await check('GET / 返回后台页面骨架', async () => {
    const response = await fetch(`${base}/`)
    assert.equal(response.status, 200)
    const html = await response.text()
    assert.match(html, /blog 文章管理/)
    assert.match(html, /\/src\/main\.ts/)
  })

  {
    /*
     * 逐个请求 src 下的模块。Vite 在响应时才编译，所以模板语法错误、`<script setup>`
     * 的问题、解析不到的 import 都会变成 500 —— 这是 vue-tsc 之外的一道网：
     * 类型检查看不出「import 的文件路径写错了」这种事在打包器里是否解析得到。
     */
    const files: string[] = []
    const walk = async (dir: string, base2 = '/src') => {
      for (const entry of await readdir(path.join(adminRoot, dir), { withFileTypes: true })) {
        const rel = `${base2}/${entry.name}`
        if (entry.isDirectory()) await walk(path.join(dir, entry.name), rel)
        else if (/\.(ts|vue)$/.test(entry.name)) files.push(rel)
      }
    }
    await walk('src')

    for (const module of files.sort()) {
      await check(`${module} 编译通过`, async () => {
        const response = await fetch(`${base}${module}`)
        const text = await response.text()
        assert.equal(response.status, 200, `HTTP ${response.status}：${text.slice(0, 300)}`)

        // .vue 的 <style> 是另外一个请求，顺手也拉一次，样式写错同样能发现
        for (const [, styleUrl] of text.matchAll(/from\s+"(\/src\/[^"]*type=style[^"]*)"/g)) {
          const styleResponse = await fetch(`${base}${styleUrl}`)
          assert.equal(
            styleResponse.status,
            200,
            `样式 ${styleUrl} → HTTP ${styleResponse.status}`,
          )
        }
      })
    }
  }
} finally {
  await server.close()
  await rm(sandbox, { recursive: true, force: true })
  // 测试产生的回收站文件清掉，别留在真仓库里
  for (const name of createdTrash) {
    await rm(path.join(adminRoot, '.trash', name), { force: true })
  }
}

console.log(failures ? `\n有 ${failures} 项没过\n` : '\n全部通过\n')
process.exit(failures ? 1 : 0)
