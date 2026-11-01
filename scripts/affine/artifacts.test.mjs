import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cp, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { cleanBuildFiles, inventory, publicPath, sha256, verifyBuild } from './artifacts.mjs'

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'blog-affine-build-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const source = join(root, 'vendor/affine')
  const output = join(root, '.affine/web')
  const put = async (name, content = '') => {
    await mkdir(join(root, name, '..'), { recursive: true })
    await writeFile(join(root, name), content)
  }
  await put('vendor/affine/.gitignore', 'node_modules\n.yarn/install-state.gz\npackages/frontend/apps/web/dist\n')
  await put('vendor/affine/source.ts', 'original source\n')
  const git = args => {
    const result = spawnSync('git', args, { cwd: source, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    return result.stdout
  }
  git(['init', '-q'])
  git(['add', '.'])
  git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture'])
  await put('.affine/web/index.html', '<script src="/affine-workspace/js/app.js"></script>')
  await put('.affine/web/js/app.js', 'workspace')
  await put('.affine/web/js/worker.js', 'worker')
  await put('.affine/web/engine.wasm', Buffer.from([0, 97, 115, 109]))
  await put('.affine/web/licenses/blog-modifications.patch', '')
  await put('.affine/workspace.sqlite', 'user data')
  await put('vendor/affine/node_modules/.yarn-state.yml', 'generated')
  await put('vendor/affine/tools/cli/node_modules/dependency.js', 'generated')
  await put('vendor/affine/packages/frontend/apps/web/dist/index.html', 'intermediate')
  await put('vendor/affine/.yarn/install-state.gz', 'generated')
  await put('vendor/affine/.yarn/releases/yarn.cjs', 'keep')
  git(['add', '.yarn/releases/yarn.cjs'])
  git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'yarn fixture'])
  await put('scripts/affine/.keep')
  for (const name of ['build.mjs', 'artifacts.mjs', 'clean.mjs']) {
    await cp(new URL(`./${name}`, import.meta.url), join(root, 'scripts/affine', name))
  }
  const upstream = { repository: 'fixture', commit: git(['rev-parse', 'HEAD']).trim(), nodeMajor: 22, yarn: '.yarn/releases/yarn.cjs' }
  await put('integrations/affine/upstream.json', JSON.stringify(upstream))
  await put('integrations/affine/local.patch', '')
  const fingerprint = sha256(Buffer.concat([
    Buffer.from(JSON.stringify({ upstream, publicPath })), Buffer.from(''),
    await readFile(join(root, 'scripts/affine/build.mjs')),
    await readFile(join(root, 'scripts/affine/artifacts.mjs')),
  ]))
  const manifest = { fingerprint, assets: await inventory(output) }
  await put('.affine/web/build-manifest.json', JSON.stringify(manifest))
  const build = (args, node = join(root, 'missing-node')) => spawnSync(process.execPath, [join(root, 'scripts/affine/build.mjs'), ...args], {
    cwd: root, encoding: 'utf8', env: { ...process.env, AFFINE_NODE: node },
  })
  return { root, source, output, put, git, fingerprint, build }
}

test('verifies every asset and rejects missing, changed, extra or symlinked files', async t => {
  const f = await fixture(t)
  assert.equal(await verifyBuild(f.output, f.fingerprint), true)
  await f.put('.affine/web/.DS_Store', 'Finder metadata')
  assert.equal(await verifyBuild(f.output, f.fingerprint), true)
  assert.equal(await verifyBuild(f.output, 'other revision'), false)
  await rm(join(f.output, 'js/worker.js'))
  assert.equal(await verifyBuild(f.output, f.fingerprint), false)
  await f.put('.affine/web/js/worker.js', 'worker')
  await f.put('.affine/web/js/app.js', 'changed')
  assert.equal(await verifyBuild(f.output, f.fingerprint), false)
  await f.put('.affine/web/js/app.js', 'workspace')
  await f.put('.affine/web/extra.js', 'extra')
  assert.equal(await verifyBuild(f.output, f.fingerprint), false)
  await rm(join(f.output, 'extra.js'))
  await symlink(join(f.source, 'source.ts'), join(f.output, 'extra.js'))
  assert.equal(await verifyBuild(f.output, f.fingerprint), false)
})

test('cleanup removes nested dependencies and dist, preserving source, runtime and data', async t => {
  const f = await fixture(t)
  await f.put('vendor/affine/source.ts', 'unsaved source\n')
  const before = f.git(['diff', '--binary', 'HEAD'])
  const removed = await cleanBuildFiles(f.source)
  assert.equal(removed.length, 4)
  assert.equal(await lstat(join(f.source, 'node_modules')).catch(() => null), null)
  assert.equal(await lstat(join(f.source, 'tools/cli/node_modules')).catch(() => null), null)
  assert.equal(await readFile(join(f.source, '.yarn/releases/yarn.cjs'), 'utf8'), 'keep')
  assert.equal(await readFile(join(f.root, '.affine/workspace.sqlite'), 'utf8'), 'user data')
  assert.equal(f.git(['diff', '--binary', 'HEAD']), before)
  assert.equal(await verifyBuild(f.output, f.fingerprint), true)
  assert.deepEqual(await cleanBuildFiles(f.source), [])
})

test('cleanup never follows dependency symlinks or removes tracked files', async t => {
  const f = await fixture(t)
  await f.put('shared/dependency.js', 'shared')
  await symlink(join(f.root, 'shared'), join(f.source, 'linked-workspace'))
  await symlink(join(f.root, 'shared'), join(f.source, 'packages/node_modules'))
  f.git(['add', '-f', 'node_modules/.yarn-state.yml'])
  await assert.rejects(cleanBuildFiles(f.source), /Git/)
  assert.ok(await lstat(join(f.source, 'tools/cli/node_modules')))
  f.git(['rm', '--cached', '-q', 'node_modules/.yarn-state.yml'])
  await cleanBuildFiles(f.source)
  assert.equal(await readFile(join(f.root, 'shared/dependency.js'), 'utf8'), 'shared')
  assert.equal(await lstat(join(f.source, 'packages/node_modules')).catch(() => null), null)
  assert.ok((await lstat(join(f.source, 'linked-workspace'))).isSymbolicLink())
})

test('reuses verified output without Node 22 or dependencies and cleans existing build files', async t => {
  const f = await fixture(t)
  const result = f.build([])
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /已复用/)
  assert.equal(await lstat(join(f.source, 'node_modules')).catch(() => null), null)
  assert.equal(f.build([]).status, 0)
  await rm(f.source, { recursive: true })
  assert.equal(f.build([]).status, 0, 'a runtime-only checkout does not require source')
})

test('keep-deps preserves installed dependencies on a cache hit', async t => {
  const f = await fixture(t)
  const result = f.build(['--keep-deps'])
  assert.equal(result.status, 0, result.stderr)
  assert.ok(await lstat(join(f.source, 'node_modules/.yarn-state.yml')))
})

test('force, local, changed patch and damaged output bypass the cache without cleaning on failure', async t => {
  const f = await fixture(t)
  for (const args of [['--force'], ['--local']]) {
    assert.notEqual(f.build(args).status, 0)
    assert.ok(await lstat(join(f.source, 'node_modules')))
  }
  await f.put('integrations/affine/local.patch', 'changed patch')
  assert.notEqual(f.build([]).status, 0)
  await f.put('integrations/affine/local.patch', '')
  await rm(join(f.output, 'js/worker.js'))
  assert.notEqual(f.build([]).status, 0)
  assert.ok(await lstat(join(f.source, 'node_modules')))
  assert.equal(await readFile(join(f.root, '.affine/workspace.sqlite'), 'utf8'), 'user data')
})

test('unsaved or untracked source changes cannot silently reuse a saved-patch build', async t => {
  const f = await fixture(t)
  await f.put('vendor/affine/source.ts', 'unsaved change')
  assert.match(f.build([]).stderr, /源码包含自定义修改/)
  await f.put('vendor/affine/source.ts', 'original source\n')
  await f.put('vendor/affine/new.ts', 'new change')
  assert.match(f.build([]).stderr, /源码包含自定义修改/)
  assert.ok(await lstat(join(f.source, 'node_modules')))
})

test('an uncached build installs, applies the patch, publishes, cleans and then reuses output', async t => {
  const f = await fixture(t)
  await cleanBuildFiles(f.source)
  await f.put('vendor/affine/.yarn/releases/yarn.cjs', `
const fs = require('node:fs');
if (process.argv[2] === 'install') {
  fs.mkdirSync('node_modules', { recursive: true });
  fs.writeFileSync('node_modules/.yarn-state.yml', 'installed');
  console.log('install-fixture');
} else {
  fs.mkdirSync('packages/frontend/apps/web/dist/js', { recursive: true });
  fs.writeFileSync('packages/frontend/apps/web/dist/index.html', 'new workspace');
  fs.writeFileSync('packages/frontend/apps/web/dist/js/app.js', 'new app');
  fs.writeFileSync('packages/frontend/apps/web/dist/js/app.js.map', 'source map');
  console.log('bundle-fixture');
}
`)
  await f.put('vendor/affine/LICENSE', 'license')
  await f.put('vendor/affine/LICENSE-MIT', 'mit')
  f.git(['add', '.'])
  f.git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'build fixture'])
  const upstream = JSON.parse(await readFile(join(f.root, 'integrations/affine/upstream.json'), 'utf8'))
  upstream.commit = f.git(['rev-parse', 'HEAD']).trim()
  upstream.nodeMajor = Number(process.versions.node.split('.')[0])
  await f.put('integrations/affine/upstream.json', JSON.stringify(upstream))
  await f.put('vendor/affine/source.ts', 'customized source\n')
  const patch = f.git(['diff', '--binary', 'HEAD'])
  await f.put('integrations/affine/local.patch', patch)
  await f.put('vendor/affine/source.ts', 'original source\n')
  const result = f.build([], process.execPath)
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /install-fixture/)
  assert.match(result.stdout, /bundle-fixture/)
  assert.equal(await readFile(join(f.output, 'index.html'), 'utf8'), 'new workspace')
  assert.equal(await readFile(join(f.output, 'licenses/blog-modifications.patch'), 'utf8'), patch)
  const manifest = JSON.parse(await readFile(join(f.output, 'build-manifest.json'), 'utf8'))
  assert.equal(await verifyBuild(f.output, manifest.fingerprint), true)
  assert.equal(await lstat(join(f.output, 'js/app.js.map')).catch(() => null), null)
  assert.equal(await lstat(join(f.source, 'node_modules')).catch(() => null), null)
  assert.equal(f.git(['diff', '--binary', 'HEAD']), patch)
  const reused = f.build([])
  assert.equal(reused.status, 0, reused.stderr)
  assert.match(reused.stdout, /已复用/)
  assert.equal(await readFile(join(f.root, '.affine/workspace.sqlite'), 'utf8'), 'user data')
})
