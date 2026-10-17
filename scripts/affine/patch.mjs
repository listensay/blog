import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const source = fileURLToPath(new URL('../../vendor/affine', import.meta.url))
const stage = spawnSync('git', ['add', '-N', '.'], { cwd: source, stdio: 'inherit' })
if (stage.status !== 0) process.exit(stage.status ?? 1)
const diff = spawnSync('git', ['diff', '--binary', 'HEAD'], { cwd: source, maxBuffer: 16 * 1024 * 1024 })
if (diff.status !== 0) throw new Error(diff.stderr.toString())
writeFileSync(new URL('../../integrations/affine/local.patch', import.meta.url), diff.stdout)
console.log('已保存 AFFiNE 源码修改到 integrations/affine/local.patch')
