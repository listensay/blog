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

async function check(label: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    pass(label)
  } catch (err) {
    fail(`${label}\n      ${err instanceof Error ? err.message.split('\n').join('\n      ') : err}`)
  }
}

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
  console.log('读')

  let firstFile = ''

  await check('GET /api/workspace 报告仓库路径和数量', async () => {
    const { status, data } = await call('GET', '/api/workspace')
    assert.equal(status, 200)
    assert.equal(data.blogRoot, sandbox)
    assert.ok((data.postCount as number) >= 1, `文章数是 ${data.postCount}`)
    assert.ok((data.pageCount as number) >= 1, `页面数是 ${data.pageCount}`)
  })

  await check('GET /api/posts 列出文章，附带分类/标签/目录候选', async () => {
    const { status, data } = await call('GET', '/api/posts')
    assert.equal(status, 200)
    const posts = data.posts as Array<Json>
    assert.ok(posts.length >= 1)
    assert.ok(Array.isArray(data.categories))
    assert.ok(Array.isArray(data.dirs))
    firstFile = String(posts[0]!.file)
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
    assert.ok(
      raw.startsWith('---\ntitle: 接口自测文章\n'),
      `文件开头是 ${JSON.stringify(raw.slice(0, 40))}`,
    )
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
    [
      '只有日期也接受（按 00:00）',
      { date: '2026-08-21', name: '只给日期', slug: 'date-only-ok' },
      201,
    ],
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

  console.log('\n图片')

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
      await writeFile(
        absolute,
        legacy.replace('date: 2026-08-19', 'date: 2026-08-19T09:30:00+08:00'),
        'utf8',
      )
      const { data } = await call('GET', `/api/post?file=${encodeURIComponent(file)}`)
      assert.equal(data.date, '2026-08-19 09:30')
    })
  }

  console.log('\n固定页（content/pages）')

  await check('GET /api/pages 列出页面，并给出保留名', async () => {
    const { status, data } = await call('GET', '/api/pages')
    assert.equal(status, 200)
    const pages = data.pages as Array<Json>
    assert.ok(pages.length >= 1, `页面数是 ${pages.length}`)
    assert.ok(
      pages.some((p) => p.file === 'pages/about.md'),
      '没列出 pages/about.md',
    )
    assert.ok((data.reserved as string[]).includes('blog'), 'reserved 里没有 blog')
  })

  await check('GET /api/page 读出正文和 friends', async () => {
    const { status, data } = await call('GET', '/api/page?file=pages/links.md')
    assert.equal(status, 200)
    assert.equal(data.path, '/links')
    assert.equal(data.name, 'links')
    assert.equal(typeof data.body, 'string')
    const friends = data.friends as Array<Json>
    assert.ok(friends.length >= 1, 'friends 是空的')
    assert.equal(typeof friends[0]!.name, 'string')
    assert.equal(typeof friends[0]!.url, 'string')
    assert.equal(typeof friends[0]!.description, 'string')
  })

  {
    const { data: allPages } = await call('GET', '/api/pages')
    for (const summary of allPages.pages as Array<Json>) {
      const file = String(summary.file)
      await check(`${file} 保存后逐字节相同`, async () => {
        const absolute = path.join(sandbox, 'content', file)
        const before = await readFile(absolute, 'utf8')

        const { data: detail } = await call('GET', `/api/page?file=${encodeURIComponent(file)}`)
        const { status } = await call('PUT', `/api/page?file=${encodeURIComponent(file)}`, detail)
        assert.equal(status, 200)

        const after = await readFile(absolute, 'utf8')
        assert.equal(after, before, '文件内容变了')
      })
    }
  }

  const pageDraft = {
    name: 'api-check-page',
    title: '接口自测页面',
    description: '这是 npm run check 造出来的',
    friends: [],
    body: '\n一段说明。\n\n![](../../public/images/x.png)\n',
  }

  let createdPage = ''

  await check('POST /api/page 新建', async () => {
    const { status, data } = await call('POST', '/api/page', pageDraft)
    assert.equal(status, 201)
    assert.equal(data.file, 'pages/api-check-page.md')
    assert.equal(data.path, '/api-check-page')
    assert.equal(data.images, 1)
    createdPage = String(data.file)

    const raw = await readFile(path.join(sandbox, 'content', createdPage), 'utf8')
    assert.ok(
      raw.startsWith('---\ntitle: 接口自测页面\n'),
      `文件开头是 ${JSON.stringify(raw.slice(0, 40))}`,
    )
    assert.ok(!raw.includes('friends:'), '空 friends 不该写进文件')
    assert.ok(raw.endsWith('![](../../public/images/x.png)\n'), '正文没原样写进去')
  })

  await check('同名再建一次 → 409', async () => {
    const { status, data } = await call('POST', '/api/page', pageDraft)
    assert.equal(status, 409)
    assert.match(String(data.error), /已存在/)
  })

  await check('PUT /api/page 改名换到子目录，正文原样写入，旧文件被清掉', async () => {
    const { data: detail } = await call('GET', `/api/page?file=${encodeURIComponent(createdPage)}`)
    const { status, data } = await call(
      'PUT',
      `/api/page?file=${encodeURIComponent(createdPage)}`,
      {
        ...detail,
        name: 'sub/api-check-page',
        title: '改过的页面标题',
      },
    )
    assert.equal(status, 200)
    assert.equal(data.file, 'pages/sub/api-check-page.md')
    assert.equal(data.path, '/sub/api-check-page')

    const raw = await readFile(path.join(sandbox, 'content', String(data.file)), 'utf8')
    assert.ok(
      raw.endsWith(String(detail.body)),
      `正文被服务端改了：${JSON.stringify(raw.slice(-60))}`,
    )

    const files = ((await call('GET', '/api/pages')).data.pages as Array<Json>).map((p) =>
      String(p.file),
    )
    assert.ok(!files.includes(createdPage), '旧文件还在')
    createdPage = String(data.file)
  })

  await check('直接建在子目录里的页面，正文按更深的层数写', async () => {
    const deep = {
      ...pageDraft,
      name: 'sub/deeper-page',
      body: '\n![](../../../public/images/x.png)\n',
    }
    const { status, data } = await call('POST', '/api/page', deep)
    assert.equal(status, 201)
    assert.equal(data.path, '/sub/deeper-page')
    const raw = await readFile(path.join(sandbox, 'content', String(data.file)), 'utf8')
    assert.ok(raw.endsWith('![](../../../public/images/x.png)\n'), '正文没原样写进去')
  })

  await check('新建时正文和 --- 之间会补一个空行（跟手写的文件一样）', async () => {
    const { status, data } = await call('POST', '/api/page', {
      ...pageDraft,
      name: 'blank-line-check',
      body: '紧贴着分隔符的一行。\n',
    })
    assert.equal(status, 201)
    const raw = await readFile(path.join(sandbox, 'content', String(data.file)), 'utf8')
    assert.ok(raw.includes('---\n\n紧贴着分隔符的一行。\n'), `落盘内容：${JSON.stringify(raw)}`)
  })

  await check('已有文件不会被补空行（打开不改就是一字不动）', async () => {
    const file = 'pages/tight-body.md'
    const absolute = path.join(sandbox, 'content', file)
    const tight = '---\ntitle: 紧贴正文\n---\n没有空行的正文。\n'
    await writeFile(absolute, tight, 'utf8')

    const { data: detail } = await call('GET', `/api/page?file=${encodeURIComponent(file)}`)
    const { status } = await call('PUT', `/api/page?file=${encodeURIComponent(file)}`, detail)
    assert.equal(status, 200)
    assert.equal(await readFile(absolute, 'utf8'), tight, '文件被改写了')
  })

  await check('DELETE /api/page 移到 admin/.trash/', async () => {
    const { status, data } = await call(
      'DELETE',
      `/api/page?file=${encodeURIComponent(createdPage)}`,
    )
    assert.equal(status, 200)

    const trashed = String(data.trashed)
    createdTrash.push(trashed)
    const trashFiles = await readdir(path.join(adminRoot, '.trash'))
    assert.ok(trashFiles.includes(trashed), `.trash 里没有 ${trashed}`)
    assert.match(trashed, /pages__sub__api-check-page\.md$/)
  })

  await check('再删一次 → 404', async () => {
    const { status } = await call('DELETE', `/api/page?file=${encodeURIComponent(createdPage)}`)
    assert.equal(status, 404)
  })

  console.log('\n页面的入参校验')

  const badPages: Array<[string, Record<string, unknown>, number]> = [
    ['标题为空', { title: '  ' }, 400],
    ['文件名为空', { name: '' }, 400],
    ['文件名带中文（会变成一串 %E5 网址）', { name: '关于我' }, 400],
    ['文件名带大写', { name: 'AboutMe' }, 400],
    ['文件名带空格', { name: 'about me' }, 400],
    ['文件名撞上站点自己的页面', { name: 'blog' }, 400],
    ['文件名撞上站点自己的页面（子路径）', { name: 'tags/x' }, 400],
    ['文件名想跳出去', { name: '../../etc/passwd' }, 400],
    ['友链没写名字', { friends: [{ name: '', url: 'https://a.com' }] }, 400],
    ['友链没写网址', { friends: [{ name: '某站', url: '' }] }, 400],
    ['友链网址不带协议（会被当成相对地址）', { friends: [{ name: '某站', url: 'a.com' }] }, 400],
    [
      '友链头像写相对路径（线上会 404）',
      { friends: [{ name: '某站', url: 'https://a.com', avatar: '../../public/images/x.png' }] },
      400,
    ],
    [
      '整条都空着的友链直接忽略，不算错',
      { name: 'blank-friend-ok', friends: [{ name: '', url: '', description: '' }] },
      201,
    ],
  ]

  for (const [label, patch, expected] of badPages) {
    await check(`${label} → ${expected}`, async () => {
      const { status } = await call('POST', '/api/page', {
        ...pageDraft,
        name: 'validate-temp-page',
        ...patch,
      })
      assert.equal(status, expected)
    })
  }

  await check('页面接口不给读文章目录 → 400', async () => {
    for (const file of ['blog/ai/免费AI公益中转站收集分享.md', '../../.env', '/etc/passwd']) {
      const { status } = await call('GET', `/api/page?file=${encodeURIComponent(file)}`)
      assert.equal(status, 400, `${file} 的状态码是 ${status}`)
    }
  })

  console.log('\n菜单（content/data/nav.json）')

  const navFile = path.join(sandbox, 'content', 'data', 'nav.json')

  await check('GET /api/nav 返回菜单和图标候选', async () => {
    const { status, data } = await call('GET', '/api/nav')
    assert.equal(status, 200)
    const items = data.items as Array<Json>
    assert.ok(items.length >= 1, '一项都没有')
    assert.equal(data.file, 'content/data/nav.json')
    const icons = data.icons as Array<Json>
    assert.ok(icons.length >= 6, `图标候选只有 ${icons.length} 个`)
    assert.ok(icons.every((i) => typeof i.value === 'string' && typeof i.label === 'string'))
  })

  await check('PUT /api/nav 存进文件，一项一行（换顺序时 diff 才看得懂）', async () => {
    const items = [
      { label: '首页', to: '/', icon: 'home', color: '#3b82f6' },
      { label: '关于', to: '/about', icon: 'about', color: '#06b6d4' },
    ]
    const { status, data } = await call('PUT', '/api/nav', { items })
    assert.equal(status, 200)
    assert.deepEqual(data.items, items)

    const raw = await readFile(navFile, 'utf8')
    const expected =
      '[\n' +
      '  { "label": "首页", "to": "/", "icon": "home", "color": "#3b82f6" },\n' +
      '  { "label": "关于", "to": "/about", "icon": "about", "color": "#06b6d4" }\n' +
      ']\n'
    assert.equal(raw, expected, `落盘内容是 ${JSON.stringify(raw)}`)
    assert.deepEqual(JSON.parse(raw), items)
  })

  await check('菜单清空后存出来是 []，不是空数组的展开写法', async () => {
    const { status } = await call('PUT', '/api/nav', { items: [] })
    assert.equal(status, 200)
    assert.equal(await readFile(navFile, 'utf8'), '[]\n')
  })

  const badNav: Array<[string, unknown]> = [
    ['不是数组', { label: '首页' }],
    ['文字为空', [{ label: ' ', to: '/', icon: 'home', color: '#3b82f6' }]],
    [
      '路径不以 / 开头（顶栏只放站内页面）',
      [{ label: '外链', to: 'https://a.com', icon: 'home', color: '#3b82f6' }],
    ],
    ['图标不认识', [{ label: '首页', to: '/', icon: '飞机', color: '#3b82f6' }]],
    ['颜色不是 #rrggbb', [{ label: '首页', to: '/', icon: 'home', color: 'red' }]],
    [
      '两项指向同一个地址',
      [
        { label: '首页', to: '/', icon: 'home', color: '#3b82f6' },
        { label: '主页', to: '/', icon: 'page', color: '#10b981' },
      ],
    ],
  ]

  for (const [label, items] of badNav) {
    await check(`${label} → 400`, async () => {
      const { status } = await call('PUT', '/api/nav', { items })
      assert.equal(status, 400)
    })
  }

  await check('校验不过时一个字都不落盘', async () => {
    const before = await readFile(navFile, 'utf8')
    await call('PUT', '/api/nav', {
      items: [{ label: '坏的', to: 'x', icon: 'home', color: '#000000' }],
    })
    assert.equal(await readFile(navFile, 'utf8'), before)
  })

  await check('nav.json 被手改坏时不报 500，界面还能打开', async () => {
    const before = await readFile(navFile, 'utf8')
    await writeFile(navFile, '{ 这不是 json', 'utf8')
    const { status, data } = await call('GET', '/api/nav')
    assert.equal(status, 200)
    assert.deepEqual(data.items, [])
    assert.ok(String(data.error).length > 0, '没把出错原因带回来')
    await writeFile(navFile, before, 'utf8')
  })

  await check('图标候选和站点侧的 NAV_ICONS 一字不差', async () => {
    const source = await readFile(path.join(realBlogRoot, 'app', 'utils', 'site.ts'), 'utf8')
    const block = /export const NAV_ICONS = \[([\s\S]*?)\] as const/.exec(source)
    assert.ok(block, '在 app/utils/site.ts 里找不到 NAV_ICONS')
    const siteIcons = [...block[1]!.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1])

    const { data } = await call('GET', '/api/nav')
    const adminIcons = (data.icons as Array<Json>).map((i) => String(i.value))
    assert.deepEqual(adminIcons, siteIcons)
  })

  console.log('\nAI')
  const aiConfigured = ((await call('GET', '/api/ai')).data.enabled as boolean) === true

  await check('GET /api/ai 报告配置状态', async () => {
    const { status, data } = await call('GET', '/api/ai')
    assert.equal(status, 200)
    assert.equal(typeof data.enabled, 'boolean')
    assert.equal(typeof data.model, 'string')
    assert.ok(String(data.model).length > 0, 'model 是空的')
    assert.ok(!('apiKey' in data), '响应里带了 apiKey')
    assert.ok(!JSON.stringify(data).includes('sk-'), '响应里像是带了密钥')
  })

  const rejected = (status: number) => [400, 503].includes(status)

  await check('不认识的动作 → 400', async () => {
    const { status } = await call('POST', '/api/ai', {
      action: '删掉全文',
      scope: 'all',
      text: 'x',
    })
    assert.ok(rejected(status), `状态码是 ${status}`)
  })

  await check('内容为空 → 400', async () => {
    const { status } = await call('POST', '/api/ai', { action: 'polish', scope: 'all', text: '  ' })
    assert.ok(rejected(status), `状态码是 ${status}`)
  })

  await check('meta：正文和标题都空 → 400', async () => {
    const { status, data } = await call('POST', '/api/ai', {
      action: 'meta',
      scope: 'all',
      text: '',
    })
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

  console.log('\n前端模块（走 dev server 的真实转换管线）')

  await check('GET / 返回后台页面骨架', async () => {
    const response = await fetch(`${base}/`)
    assert.equal(response.status, 200)
    const html = await response.text()
    assert.match(html, /blog 管理/)
    assert.match(html, /\/src\/main\.ts/)
  })

  {
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

        for (const [, styleUrl] of text.matchAll(/from\s+"(\/src\/[^"]*type=style[^"]*)"/g)) {
          const styleResponse = await fetch(`${base}${styleUrl}`)
          assert.equal(styleResponse.status, 200, `样式 ${styleUrl} → HTTP ${styleResponse.status}`)
        }
      })
    }
  }
} finally {
  await server.close()
  await rm(sandbox, { recursive: true, force: true })
  for (const name of createdTrash) {
    await rm(path.join(adminRoot, '.trash', name), { force: true })
  }
}

console.log(failures ? `\n有 ${failures} 项没过\n` : '\n全部通过\n')
process.exit(failures ? 1 : 0)
