import { readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { type Workspace, ensureDir, toPosix } from './paths.ts'

async function exists(absolute: string): Promise<boolean> {
  try {
    await stat(absolute)
    return true
  } catch {
    return false
  }
}

export async function moveToTrash(
  ws: Workspace,
  absolute: string,
  flatName: string,
): Promise<string> {
  ensureDir(ws.trashDir)

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace(/T/, '_').slice(0, 19)

  let target = path.join(ws.trashDir, `${stamp}__${flatName}`)
  let n = 1
  while (await exists(target)) {
    target = path.join(ws.trashDir, `${stamp}__${flatName}.${n++}`)
  }

  await rename(absolute, target).catch(async (err: NodeJS.ErrnoException) => {
    if (err.code !== 'EXDEV') throw err
    await writeFile(target, await readFile(absolute))
    await unlink(absolute)
  })

  return toPosix(path.relative(ws.trashDir, target))
}
