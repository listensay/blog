import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstat, readFile, readdir, rm } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'

export const publicPath = '/affine-workspace/'
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

export async function inventory(directory, prefix = '') {
  const assets = {}
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue
    const name = `${prefix}${entry.name}`
    if (name === 'build-manifest.json') continue
    const file = join(directory, entry.name)
    if (entry.isDirectory()) Object.assign(assets, await inventory(file, `${name}/`))
    else if (entry.isFile()) assets[name] = sha256(await readFile(file))
    else throw new Error(`构建产物包含非普通文件：${name}`)
  }
  return assets
}

export async function verifyBuild(directory, fingerprint) {
  try {
    const manifest = JSON.parse(await readFile(join(directory, 'build-manifest.json'), 'utf8'))
    if (manifest.fingerprint !== fingerprint || !manifest.assets?.['index.html']) return false
    const assets = await inventory(directory)
    return Object.keys(assets).length === Object.keys(manifest.assets).length &&
      Object.entries(assets).every(([name, hash]) => manifest.assets[name] === hash)
  } catch {
    return false
  }
}

export async function cleanBuildFiles(source) {
  // Yarn can install dependencies inside individual workspaces as well as at the root.
  const targets = []
  async function findDependencies(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === '.git') continue
      const file = join(directory, entry.name)
      if (entry.name === 'node_modules') targets.push(file)
      else if (entry.isDirectory()) await findDependencies(file)
    }
  }
  if (!(await lstat(join(source, '.git')).catch(() => null))) return []
  await findDependencies(source)
  targets.push(join(source, '.yarn/install-state.gz'), join(source, 'packages/frontend/apps/web/dist'))
  const tracked = spawnSync('git', ['ls-files', '-z'], { cwd: source, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  if (tracked.status !== 0) throw new Error(`无法检查源码文件：${tracked.stderr || tracked.error}`)
  const files = tracked.stdout.split('\0').filter(Boolean)
  for (const target of targets) {
    const name = relative(source, target).split(sep).join('/')
    if (files.some(file => file === name || file.startsWith(`${name}/`))) {
      throw new Error(`清理目录包含 Git 管理的文件，已停止：${name}`)
    }
  }
  const removed = []
  for (const target of targets) {
    if (!(await lstat(target).catch(() => null))) continue
    // rm removes symlinks themselves; it must never follow them into shared dependencies.
    await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    removed.push(relative(resolve(source), target))
  }
  return removed
}
