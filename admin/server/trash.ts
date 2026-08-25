/** 删除是挪到 `admin/.trash/`，不是 unlink；文件名加时间戳，同名不覆盖。文章和页面共用 */
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

/** 把文件挪进回收站，返回它在 `.trash/` 里的名字。`flatName` 是压平后的名字（`docs__x.md`） */
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
    // 跨设备（.trash 和仓库不在一个卷上）时 rename 会 EXDEV，退化成复制+删除
    if (err.code !== 'EXDEV') throw err
    await writeFile(target, await readFile(absolute))
    await unlink(absolute)
  })

  return toPosix(path.relative(ws.trashDir, target))
}
