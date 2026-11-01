import { spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanBuildFiles, inventory, publicPath, sha256, verifyBuild } from './artifacts.mjs'

const args = new Set(process.argv.slice(2))
for (const arg of args) {
  if (!['--force', '--local', '--keep-deps', '--help'].includes(arg)) throw new Error(`未知参数：${arg}`)
}
if (args.has('--help')) {
  console.log('npm run affine:build [-- --force | --local | --keep-deps]\n--force      重新构建，不复用产物\n--local      构建当前源码，包括未保存到补丁的修改\n--keep-deps  构建后保留依赖与中间产物\nnpm run affine:clean  清理构建依赖与中间产物')
  process.exit(0)
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const upstream = JSON.parse(await readFile(join(root, 'integrations/affine/upstream.json'), 'utf8'))
const source = join(root, 'vendor/affine')
const output = join(root, '.affine/web')
const patch = join(root, 'integrations/affine/local.patch')
const patchBytes = await readFile(patch)
const fingerprint = sha256(Buffer.concat([
  Buffer.from(JSON.stringify({ upstream, publicPath })),
  patchBytes,
  await readFile(fileURLToPath(import.meta.url)),
  await readFile(new URL('./artifacts.mjs', import.meta.url)),
]))

function git(args) {
  const result = spawnSync('git', args, { cwd: source, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(`git failed: ${result.stderr || result.error || result.status}`)
  return result.stdout
}
const initialized = !!(await stat(join(source, '.git')).catch(() => null))
if (initialized) {
  if (git(['rev-parse', 'HEAD']).trim() !== upstream.commit) throw new Error('AFFiNE 源码版本与 upstream.json 不一致')
  const diff = git(['diff', '--binary', 'HEAD'])
  const untracked = git(['ls-files', '--others', '--exclude-standard'])
  if (!args.has('--local') && (untracked || (diff && diff !== patchBytes.toString('utf8')))) {
    throw new Error('源码包含自定义修改；请先运行 npm run affine:patch，或使用 npm run affine:build -- --local 构建当前源码。')
  }
}
if (!args.has('--force') && !args.has('--local') && await verifyBuild(output, fingerprint)) {
  if (!args.has('--keep-deps')) await cleanBuildFiles(source)
  console.log(`AFFiNE 工作区产物未变，已复用：${output}`)
  process.exit(0)
}

let node = process.env.AFFINE_NODE || process.execPath
if (!process.env.AFFINE_NODE && Number(process.versions.node.split('.')[0]) !== upstream.nodeMajor) {
  const result = spawnSync('fnm', ['exec', '--using', String(upstream.nodeMajor), 'node', '-p', 'process.execPath'], { encoding: 'utf8' })
  if (result.status === 0) node = result.stdout.trim()
}
const env = { ...process.env, PATH: `${dirname(node)}:${process.env.PATH}`, BUILD_TYPE: 'stable', PUBLIC_PATH: publicPath, NODE_OPTIONS: '--max-old-space-size=8192' }
for (const key of ['R2_SECRET_ACCESS_KEY', 'R2_ACCESS_KEY_ID', 'SENTRY_AUTH_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECT']) delete env[key]
function run(command, args, cwd = source, capture = false) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' })
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.error || result.status}`)
  return result.stdout?.trim()
}
if (run(node, ['-p', 'process.versions.node.split(".")[0]'], root, true) !== String(upstream.nodeMajor)) throw new Error('请安装 Node 22，或通过 AFFINE_NODE 指定 Node 22 可执行文件。')
if (!initialized) run('git', ['submodule', 'update', '--init', '--depth', '1', 'vendor/affine'], root)
if (run('git', ['rev-parse', 'HEAD'], source, true) !== upstream.commit) throw new Error('AFFiNE 源码版本与 upstream.json 不一致')
const check = args => spawnSync('git', ['apply', ...args, patch], { cwd: source, stdio: 'ignore' }).status === 0
if (check(['--check'])) run('git', ['apply', patch])
else if (!check(['--reverse', '--check']) && !args.has('--local')) throw new Error('源码包含自定义修改；确认保留后使用 npm run affine:build -- --local 构建当前源码。')
if (!(await stat(join(source, 'node_modules/.yarn-state.yml')).catch(() => null))) run(node, [upstream.yarn, 'install', '--immutable'])
run(node, [upstream.yarn, 'affine', 'bundle', '-p', '@affine/web'])
await mkdir(dirname(output), { recursive: true })
const staging = await mkdtemp(`${output}.building-`)
try {
  await cp(join(source, 'packages/frontend/apps/web/dist'), staging, {
    recursive: true, filter: path => !path.endsWith('.map') && !path.endsWith('/.DS_Store'),
  })
  await mkdir(join(staging, 'licenses'), { recursive: true })
  for (const file of ['LICENSE', 'LICENSE-MIT']) await cp(join(source, file), join(staging, 'licenses', file))
  await writeFile(join(staging, 'licenses/blog-modifications.patch'), patchBytes)
  // Local-only builds must not be reused as if they were built from the saved patch.
  const savedSource = git(['diff', '--binary', 'HEAD']) === patchBytes.toString('utf8') &&
    !git(['ls-files', '--others', '--exclude-standard'])
  await writeFile(join(staging, 'build-manifest.json'), JSON.stringify({
    ...upstream, publicPath, fingerprint: savedSource ? fingerprint : null,
    builtAt: new Date().toISOString(), assets: await inventory(staging),
  }, null, 2) + '\n')
  if (!await verifyBuild(staging, savedSource ? fingerprint : null)) throw new Error('AFFiNE 构建产物校验失败')
  const backup = await mkdtemp(`${output}.previous-`)
  const previous = join(backup, 'web')
  const hadOutput = !!(await stat(output).catch(() => null))
  let keepBackup = false
  try {
    if (hadOutput) await rename(output, previous)
    try {
      // Rename avoids keeping another full copy of the generated assets.
      await rename(staging, output)
    } catch (error) {
      if (hadOutput) {
        keepBackup = true
        await rename(previous, output)
        keepBackup = false
      }
      throw error
    }
  } finally {
    if (!keepBackup) await rm(backup, { recursive: true, force: true })
  }
} finally {
  await rm(staging, { recursive: true, force: true })
}
if (!args.has('--keep-deps')) {
  await cleanBuildFiles(source)
  console.log('已清理 AFFiNE 构建依赖与中间产物')
}
console.log(`AFFiNE 工作区已构建：${output}`)
