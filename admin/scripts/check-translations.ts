import assert from 'node:assert/strict'
import { createServer as createHttpServer } from 'node:http'
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'
import { blogAdminApi } from '../server/blog-api.ts'
import { resolveWorkspace } from '../server/paths.ts'
import { readPost, trashPost, updatePost } from '../server/posts.ts'
import { normalizeTranslationAssets } from '../server/translation-integrity.ts'

const sandbox = await mkdtemp(path.join(tmpdir(), 'blog-translations-'))
const adminRoot = path.resolve(import.meta.dirname, '..')
await mkdir(path.join(sandbox, 'content/blog/ai'), { recursive: true })
await mkdir(path.join(sandbox, 'public/images'), { recursive: true })
await mkdir(path.join(sandbox, 'content/pages'), { recursive: true })
const file = 'blog/ai/中文标题.md'
const source =
  '---\ntitle: 中文标题\ndescription: 中文摘要\ndate: 2026-09-13 00:00\nslug: translation-test\ncategory: AI\ntags: [AI]\n---\n\n## 使用方法\n\n你好。\n\n![图片](../../../public/images/example.png)\n\n[网站](https://example.com/path?q=1)\n\n```js\nconst url = "../../../public/images/example.png"\n```\n\n<details>\n<summary><h3>说明</h3></summary>\n\n更多文字。\n\n</details>\n'
await writeFile(path.join(sandbox, 'content', file), source)
let mode = 'success'
let calls = 0
const mock = createHttpServer(async (req, res) => {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const request = JSON.parse(Buffer.concat(chunks).toString())
  calls++
  assert.equal(req.headers.authorization, 'Bearer test-key')
  assert.equal(request.model, 'test-model')
  const data = JSON.parse(request.messages[1].content)
  assert.ok(data.body.includes('/images/example.png'))
  let body = data.body
    .replace('使用方法', 'Usage')
    .replace('你好。', 'Hello.')
    .replace('![图片]', '![Image]')
    .replace('[网站]', '[Website]')
    .replace('>说明<', '>Details<')
    .replace('更多文字。', 'More text.')
  if (mode === 'links')
    body = body.replace('https://example.com/path?q=1', 'https://wrong.example/')
  if (mode === 'code') body = body.replace('const url', 'let url')
  if (mode === 'html') body += '\n<script>alert(1)</script>'
  if (mode === 'stale')
    await writeFile(path.join(sandbox, 'content', file), source.replace('中文摘要', '修改后的摘要'))
  if (mode === 'http') {
    res.writeHead(429)
    res.end('{"error":{"message":"rate limited"}}')
    return
  }
  res.setHeader('content-type', 'application/json')
  const result = JSON.stringify({ title: 'English title', description: 'English summary', body })
  res.end(
    JSON.stringify({
      choices: [
        {
          finish_reason: mode === 'truncated' ? 'length' : 'stop',
          message: {
            content:
              mode === 'json'
                ? '{broken'
                : mode === 'fenced'
                  ? `\`\`\`json\n${result}\n\`\`\``
                  : result,
          },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 100 },
    }),
  )
})
await new Promise<void>((resolve) => mock.listen(0, '127.0.0.1', resolve))
const mockAddress = mock.address() as { port: number }
process.env.ADMIN_BLOG_ROOT = sandbox
process.env.ADMIN_AI_API_KEY = 'test-key'
process.env.ADMIN_AI_BASE_URL = `http://127.0.0.1:${mockAddress.port}/v1`
process.env.ADMIN_AI_MODEL = 'test-model'
const server = await createServer({
  configFile: false,
  root: adminRoot,
  envDir: sandbox,
  plugins: [blogAdminApi()],
  logLevel: 'silent',
  server: { port: 0, host: '127.0.0.1' },
})
await server.listen()
const address = server.httpServer!.address() as { port: number }
const base = `http://127.0.0.1:${address.port}`
const endpoint = `/api/post/translation?file=${encodeURIComponent(file)}`
const aiEndpoint = `/api/post/translation/ai?file=${encodeURIComponent(file)}`
async function call(url: string, method = 'GET', body?: unknown) {
  const response = await fetch(base + url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: response.status, data: await response.json() }
}

try {
  const initial = await call(endpoint)
  assert.equal(initial.status, 200)
  assert.equal(initial.data.content, null)
  assert.equal(initial.data.path, '/en/blog/ai/translation-test')
  assert.equal(
    (await call('/api/posts')).data.posts[0].english,
    null,
    'List marks untranslated posts',
  )
  const candidate = await call(aiEndpoint, 'POST', { sourceRevision: initial.data.sourceRevision })
  assert.equal(candidate.status, 200)
  assert.equal((await call(endpoint)).data.content, null, 'Generation must not write a file')
  const save = { ...candidate.data, draft: true, revision: null }
  const saved = await call(endpoint, 'PUT', save)
  assert.equal(saved.status, 200)
  assert.equal(saved.data.outdated, false)
  assert.equal(saved.data.content.draft, true)
  assert.deepEqual(
    (await call('/api/posts')).data.posts[0].english,
    {
      file: saved.data.file,
      path: saved.data.path,
      draft: true,
      outdated: false,
    },
    'List shows the saved English draft',
  )

  const published = await call(endpoint, 'PUT', {
    ...save,
    draft: false,
    revision: saved.data.revision,
  })
  assert.equal(published.status, 200)
  assert.equal(
    (await call('/api/posts')).data.posts[0].english.draft,
    false,
    'List shows publication',
  )
  assert.equal(
    await readFile(path.join(sandbox, 'content', file), 'utf8'),
    source,
    'Chinese source must remain byte-identical',
  )
  const english = await readFile(path.join(sandbox, 'content', saved.data.file), 'utf8')
  assert.ok(english.includes('![Image](/images/example.png)'))
  assert.ok(
    english.includes('const url = "../../../public/images/example.png"'),
    'Code paths must remain unchanged',
  )
  assert.equal((await call(endpoint, 'PUT', save)).status, 409, 'Reject stale English revision')

  mode = 'fenced'
  const fenced = await call(aiEndpoint, 'POST', { sourceRevision: initial.data.sourceRevision })
  assert.equal(fenced.status, 200, 'Accept fenced JSON containing Markdown code fences')
  assert.equal(fenced.data.body, candidate.data.body)
  assert.equal((await call(endpoint, 'PUT', null)).status, 400, 'Reject null input')

  for (mode of ['truncated', 'json', 'links', 'code', 'html', 'http']) {
    const response = await call(aiEndpoint, 'POST', { sourceRevision: initial.data.sourceRevision })
    assert.ok(response.status >= 400, `Reject ${mode}`)
    assert.equal(
      await readFile(path.join(sandbox, 'content', saved.data.file), 'utf8'),
      english,
      'Failed generation must preserve translation',
    )
  }
  mode = 'stale'
  assert.equal(
    (await call(aiEndpoint, 'POST', { sourceRevision: initial.data.sourceRevision })).status,
    409,
  )
  assert.equal((await call(endpoint)).data.outdated, true)
  assert.equal(
    (await call('/api/posts')).data.posts[0].english.outdated,
    true,
    'List flags changed sources',
  )
  assert.equal(
    (await call(endpoint, 'PUT', { ...save, revision: saved.data.revision })).status,
    409,
  )
  await writeFile(path.join(sandbox, 'content', file), source)
  mode = 'success'
  assert.equal((await call('/api/post/translation?file=../outside.md')).status, 400)
  const ws = { ...resolveWorkspace(adminRoot), trashDir: path.join(sandbox, 'trash') }
  const original = await readPost(ws, file)
  const moved = await updatePost(ws, file, {
    ...original,
    dir: 'docs',
    slug: 'renamed-test',
    draft: true,
  })
  assert.equal(
    (await call(`/api/post/translation?file=${encodeURIComponent(moved.file)}`)).data.path,
    '/en/blog/docs/renamed-test',
  )
  assert.equal((await readdir(path.join(sandbox, 'content/en/blog/ai'))).length, 0)
  const movedEnglish = await readFile(
    path.join(sandbox, 'content/en/blog/docs/renamed-test.md'),
    'utf8',
  )
  assert.ok(movedEnglish.includes('draft: true'))
  assert.equal((await call('/api/posts')).data.posts[0].english.path, '/en/blog/docs/renamed-test')
  assert.equal((await call('/api/posts')).data.posts[0].english.draft, true)
  await trashPost(ws, moved.file)
  assert.equal(
    (await readdir(path.join(sandbox, 'trash'))).length,
    2,
    'Delete moves both versions to trash',
  )

  await writeFile(path.join(sandbox, 'content', file), source)
  await rm(path.join(sandbox, 'content/en'), { recursive: true })
  const outside = path.join(sandbox, 'outside')
  await mkdir(outside)
  await symlink(outside, path.join(sandbox, 'content/en'))
  assert.equal((await call(endpoint)).status, 400, 'Reject symlink escape')
  assert.ok(calls >= 8)
  assert.ok(normalizeTranslationAssets('`../../../public/images/a.png`', file).startsWith('`../'))
  console.log(
    'Translation checks passed: AI generation, draft/publication status, revisions, content integrity, asset paths, move/delete, failures, and path safety.',
  )
} finally {
  await server.close()
  await new Promise<void>((resolve) => mock.close(() => resolve()))
  await rm(sandbox, { recursive: true, force: true })
}
