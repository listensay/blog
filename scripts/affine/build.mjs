import { spawnSync } from 'node:child_process'
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const upstream = JSON.parse(await readFile(join(root, 'integrations/affine/upstream.json'), 'utf8'))
const source = join(root, 'vendor/affine')
let node = process.env.AFFINE_NODE || process.execPath
if (!process.env.AFFINE_NODE && Number(process.versions.node.split('.')[0]) !== 22) {
  const result = spawnSync('fnm', ['exec', '--using', '22', 'node', '-p', 'process.execPath'], { encoding: 'utf8' })
  if (result.status === 0) node = result.stdout.trim()
}
const env = { ...process.env, PATH: `${dirname(node)}:${process.env.PATH}`, BUILD_TYPE: 'stable', PUBLIC_PATH: '/affine-workspace/', NODE_OPTIONS: '--max-old-space-size=8192' }
for (const key of ['R2_SECRET_ACCESS_KEY', 'R2_ACCESS_KEY_ID', 'SENTRY_AUTH_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECT']) delete env[key]
function run(command, args, cwd = source, capture = false) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' })
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.error || result.status}`)
  return result.stdout?.trim()
}
if (run(node, ['-p', 'process.versions.node.split(".")[0]'], root, true) !== '22') throw new Error('请安装 Node 22，或通过 AFFINE_NODE 指定 Node 22 可执行文件。')
if (!(await stat(join(source, '.git')).catch(() => null))) run('git', ['submodule', 'update', '--init', '--depth', '1', 'vendor/affine'], root)
if (run('git', ['rev-parse', 'HEAD'], source, true) !== upstream.commit) throw new Error('AFFiNE 源码版本与 upstream.json 不一致')
const patch = join(root, 'integrations/affine/local.patch')
const check = args => spawnSync('git', ['apply', ...args, patch], { cwd: source, stdio: 'ignore' }).status === 0
if (check(['--check'])) run('git', ['apply', patch])
else if (!check(['--reverse', '--check']) && !process.argv.includes('--local')) throw new Error('源码包含自定义修改；确认保留后使用 npm run affine:build -- --local 构建当前源码。')
if (!(await stat(join(source, 'node_modules/.yarn-state.yml')).catch(() => null))) run(node, [upstream.yarn, 'install', '--immutable'])
run(node, [upstream.yarn, 'affine', 'bundle', '-p', '@affine/web'])
const output = join(root, '.affine/web')
const staging = `${output}.building`
await rm(staging, { recursive: true, force: true })
await cp(join(source, 'packages/frontend/apps/web/dist'), staging, { recursive: true, filter: path => !path.endsWith('.map') })
await mkdir(join(staging, 'licenses'), { recursive: true })
for (const file of ['LICENSE', 'LICENSE-MIT']) await cp(join(source, file), join(staging, 'licenses', file))
await cp(patch, join(staging, 'licenses/blog-modifications.patch'))
await writeFile(join(staging, 'build-manifest.json'), JSON.stringify({ ...upstream, builtAt: new Date().toISOString() }, null, 2) + '\n')
await rm(output, { recursive: true, force: true })
await cp(staging, output, { recursive: true })
await rm(staging, { recursive: true, force: true })
console.log(`AFFiNE 工作区已构建：${output}`)
