import { cp, mkdir, readFile, rm, writeFile, chmod, access } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { build } from 'esbuild'
import { build as buildFrontend } from 'vite'

const admin = fileURLToPath(new URL('../', import.meta.url))
const root = path.resolve(admin, '..')
const affine = path.join(root, '.affine/web')
const resources = path.join(admin, 'src-tauri/resources')
if (Number(process.versions.node.split('.')[0]) < 24)
  throw new Error('桌面打包需要 Node.js 24 或更高版本')
try {
  await access(path.join(affine, 'index.html'))
} catch {
  throw new Error('请先在项目根目录运行 npm run affine:build')
}
const host = execFileSync('rustc', ['-vV'], { encoding: 'utf8' }).match(/^host: (.+)$/m)?.[1]
if (!host) throw new Error('无法确定 Rust 编译目标')
const target = process.env.TAURI_ENV_TARGET_TRIPLE || host
if (target !== host) throw new Error('Node 运行时需要在目标平台上打包，请使用对应系统构建应用')
const architectures = { arm64: 'aarch64', x64: 'x86_64', ia32: 'i686', arm: 'arm' }
if (target.split('-')[0] !== architectures[process.arch])
  throw new Error('Node.js 与 Rust 的处理器架构不一致，请安装相同架构的工具链')
let license
for (const candidate of ['../LICENSE', '../../LICENSE', '../../share/doc/node/LICENSE']) {
  license = await readFile(path.resolve(process.execPath, candidate), 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return undefined
    throw error
  })
  if (license) break
}
if (!license) throw new Error('找不到 Node.js LICENSE，请使用包含许可证的 Node.js 官方安装包')
await buildFrontend({ root: admin, configFile: path.join(admin, 'vite.config.ts') })
await mkdir(resources, { recursive: true })
for (const name of ['frontend', 'affine'])
  await rm(path.join(resources, name), { recursive: true, force: true })
await cp(path.join(admin, 'dist'), path.join(resources, 'frontend'), { recursive: true })
await cp(affine, path.join(resources, 'affine'), { recursive: true })
await build({
  entryPoints: [path.join(admin, 'server/entry.ts')],
  outfile: path.join(resources, 'service.mjs'),
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
})
const binaries = path.join(admin, 'src-tauri/binaries')
await mkdir(binaries, { recursive: true })
const node = path.join(binaries, `blog-node-${target}${process.platform === 'win32' ? '.exe' : ''}`)
await cp(process.execPath, node)
await chmod(node, 0o755)
await writeFile(path.join(resources, 'NODE-LICENSE'), license)
console.log('桌面资源已就绪')
