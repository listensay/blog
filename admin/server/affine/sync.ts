import { createHash } from 'node:crypto'
import { lstat, mkdir, open, readFile, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import type { Workspace } from '../paths.ts'
import { stateDir } from './config.ts'
import { isContentFile } from './document.ts'
export const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')

export async function safeContentPath(ws: Workspace, file: string): Promise<string> {
  if (!isContentFile(file)) throw new Error(`内容路径不合法：${file}`)
  const absolute = path.join(ws.contentDir, file)
  for (let current = absolute; ; current = path.dirname(current)) {
    try {
      if ((await lstat(current)).isSymbolicLink())
        throw new Error(`内容路径不能是符号链接：${file}`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    if (current === ws.contentDir) break
  }
  return absolute
}

export async function contentFiles(ws: Workspace, directory = ws.contentDir): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await contentFiles(ws, absolute)))
    else if (entry.isFile()) {
      const relative = path.relative(ws.contentDir, absolute).split(path.sep).join('/')
      if (isContentFile(relative)) files.push(relative)
    }
  }
  return files
}

export async function withSyncLock<T>(ws: Workspace, action: () => Promise<T>): Promise<T> {
  await mkdir(stateDir(ws), { recursive: true })
  const file = path.join(stateDir(ws), 'sync.lock')
  const acquire = () => open(file, 'wx', 0o600)
  let lock
  try {
    lock = await acquire()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    const pid = Number(await readFile(file, 'utf8'))
    if (!Number.isInteger(pid) || pid <= 0)
      throw new Error('同步锁无效，请确认没有同步进程后删除 .affine/sync.lock')
    try {
      process.kill(pid, 0)
      throw new Error('另一个 AFFiNE 同步进程正在运行')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
    }
    await rm(file)
    lock = await acquire()
  }
  try {
    await lock.writeFile(String(process.pid))
    return await action()
  } finally {
    await lock.close()
    await rm(file, { force: true })
  }
}

