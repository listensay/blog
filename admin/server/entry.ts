import { readFile } from 'node:fs/promises'
import { parseEnv } from 'node:util'
import path from 'node:path'
import { startDesktopServer } from './desktop.ts'
import { resolveWorkspace } from './paths.ts'

const [blogRoot, resources] = process.argv.slice(2)
if (!blogRoot || !resources) throw new Error('缺少博客目录或应用资源')
const workspace = resolveWorkspace(path.join(blogRoot, 'admin'), blogRoot)
const env: Record<string, string> = {}
for (const name of ['.env', '.env.local']) {
  const raw = await readFile(path.join(blogRoot, 'admin', name), 'utf8').catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return ''
      throw error
    },
  )
  for (const [key, value] of Object.entries(parseEnv(raw))) {
    if (key.startsWith('AFFINE_AI_') && value !== undefined) env[key] = value
  }
}
const server = await startDesktopServer({
  workspace,
  env,
  frontendRoot: path.join(resources, 'frontend'),
  affineRoot: path.join(resources, 'affine'),
})
process.stdout.write(`${JSON.stringify({ url: server.url })}\n`)
let stopping = false
async function stop() {
  if (stopping) return
  stopping = true
  await server.close()
  process.exit(0)
}
process.stdin.resume()
process.stdin.on('end', () => void stop())
process.on('SIGTERM', () => void stop())
process.on('SIGINT', () => void stop())
