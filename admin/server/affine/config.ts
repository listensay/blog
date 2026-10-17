import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import type { Workspace } from '../paths.ts'

export function stateDir(ws: Workspace) {
  return path.join(ws.blogRoot, '.affine')
}

export async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback
    throw new Error(`无法读取 ${path.basename(file)}，请修复文件后重试`)
  }
}

export async function atomicWrite(file: string, text: string | Uint8Array) {
  await mkdir(path.dirname(file), { recursive: true })
  const temp = `${file}.${randomUUID()}.tmp`
  try {
    await writeFile(temp, text, { mode: 0o600, flag: 'wx' })
    await rename(temp, file)
  } finally {
    await rm(temp, { force: true })
  }
}

