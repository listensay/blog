import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { badRequest } from '../http.ts'

type Query = Record<string, unknown>
const text = (q: Query, key: string, fallback?: string): string => {
  const value = q[key] ?? fallback
  if (typeof value !== 'string' || value.length > 8192) throw badRequest(`无效字段：${key}`)
  return value
}
const bytes = (q: Query, key: string) => {
  const value = q[key]
  if (!Array.isArray(value) || value.length > 24 * 1024 * 1024 || value.some(v => !Number.isInteger(v) || v < 0 || v > 255))
    throw badRequest('附件或文档数据无效')
  return Buffer.from(value)
}
const time = (value: unknown) => {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw badRequest('文档时间无效')
  return Number(value)
}

export class WorkspaceStorage {
  readonly db: DatabaseSync
  constructor(file: string) {
    mkdirSync(path.dirname(file), { recursive: true })
    this.db = new DatabaseSync(file)
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS snapshots(space TEXT,id TEXT,bin BLOB NOT NULL,at INTEGER NOT NULL,PRIMARY KEY(space,id));
      CREATE TABLE IF NOT EXISTS updates(space TEXT,id TEXT,bin BLOB NOT NULL,at INTEGER NOT NULL,PRIMARY KEY(space,id,at));
      CREATE TABLE IF NOT EXISTS clocks(space TEXT,id TEXT,at INTEGER NOT NULL,PRIMARY KEY(space,id));
      CREATE TABLE IF NOT EXISTS blobs(space TEXT,id TEXT,bin BLOB NOT NULL,mime TEXT,at INTEGER,deleted INTEGER DEFAULT 0,PRIMARY KEY(space,id));
      CREATE TABLE IF NOT EXISTS metadata(scope TEXT,key TEXT,value TEXT NOT NULL,PRIMARY KEY(scope,key));`)
  }
  close() { this.db.close() }
  request(input: unknown): unknown {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw badRequest('工作区请求无效')
    const q = input as Query
    const op = text(q, 'op'), space = text(q, 'space'), id = text(q, 'id', '')
    if (!space || (!id && !['clocks', 'blobList', 'blobRelease', 'kvList'].includes(op))) throw badRequest('工作区或文档标识为空')
    const db = this.db
    const run = (sql: string, ...args: (string | number | Uint8Array)[]) => db.prepare(sql).run(...args)
    const get = (sql: string, ...args: (string | number)[]) => db.prepare(sql).get(...args)
    const all = (sql: string, ...args: (string | number)[]) => db.prepare(sql).all(...args)
    db.exec('BEGIN IMMEDIATE')
    try {
      let result: unknown = null
      switch (op) {
        case 'push': case 'import': {
          const bin = bytes(q, 'bin')
          const old = Number(get('SELECT at FROM clocks WHERE space=? AND id=?', space, id)?.at ?? 0)
          const at = Math.max(op === 'import' ? time(q.at) : Date.now(), old + 1)
          run('INSERT INTO updates VALUES (?,?,?,?)', space, id, bin, at)
          run('INSERT INTO clocks VALUES (?,?,?) ON CONFLICT(space,id) DO UPDATE SET at=MAX(at,excluded.at)', space, id, at)
          result = at; break
        }
        case 'snapshot': {
          const row = get('SELECT bin,at FROM snapshots WHERE space=? AND id=?', space, id)
          result = row ? { docId: id, bin: Array.from(row.bin as Uint8Array), at: row.at } : null; break
        }
        case 'setSnapshot': {
          run('INSERT INTO snapshots VALUES (?,?,?,?) ON CONFLICT(space,id) DO UPDATE SET bin=excluded.bin,at=excluded.at WHERE excluded.at>snapshots.at', space, id, bytes(q, 'bin'), time(q.at))
          result = true; break
        }
        case 'updates': result = all('SELECT bin,at FROM updates WHERE space=? AND id=? ORDER BY at', space, id).map(row => ({ docId: id, bin: Array.from(row.bin as Uint8Array), at: row.at })); break
        case 'merge': {
          if (!Array.isArray(q.times)) throw badRequest('合并时间无效')
          let count = 0
          // Only remove updates that are covered by a durable snapshot.
          for (const at of q.times) count += Number(run('DELETE FROM updates WHERE space=? AND id=? AND at=? AND at <= COALESCE((SELECT at FROM snapshots WHERE space=? AND id=?),-1)', space, id, time(at), space, id).changes)
          result = count; break
        }
        case 'clocks': result = all('SELECT id,at FROM clocks WHERE space=? AND at>?', space, time(q.after ?? 0)); break
        case 'clock': result = get('SELECT at FROM clocks WHERE space=? AND id=?', space, id)?.at ?? null; break
        case 'deleteDoc': for (const table of ['snapshots', 'updates', 'clocks']) run(`DELETE FROM ${table} WHERE space=? AND id=?`, space, id); break
        case 'blobGet': {
          const row = get('SELECT bin,mime,at FROM blobs WHERE space=? AND id=? AND deleted=0', space, id)
          result = row ? { key: id, data: Array.from(row.bin as Uint8Array), mime: row.mime, at: row.at } : null; break
        }
        case 'blobSet': run('INSERT INTO blobs VALUES (?,?,?,?,?,0) ON CONFLICT(space,id) DO UPDATE SET bin=excluded.bin,mime=excluded.mime,at=excluded.at,deleted=0', space, id, bytes(q, 'data'), text(q, 'mime'), time(q.at ?? Date.now())); break
        case 'blobDelete': run(q.permanently === true ? 'DELETE FROM blobs WHERE space=? AND id=?' : 'UPDATE blobs SET deleted=1 WHERE space=? AND id=?', space, id); break
        case 'blobRelease': run('DELETE FROM blobs WHERE space=? AND deleted=1', space); break
        case 'blobList': result = all('SELECT id AS key,mime,length(bin) AS size,at FROM blobs WHERE space=? AND deleted=0', space); break
        case 'kvGet': result = get('SELECT value FROM metadata WHERE scope=? AND key=?', space, id)?.value ?? null; break
        case 'kvSet': {
          if (typeof q.value !== 'string' || q.value.length > 24 * 1024 * 1024) throw badRequest('工作区设置无效')
          run('INSERT INTO metadata VALUES (?,?,?) ON CONFLICT(scope,key) DO UPDATE SET value=excluded.value', space, id, q.value); break
        }
        case 'kvDelete': run('DELETE FROM metadata WHERE scope=? AND key=?', space, id); break
        case 'kvList': result = Object.fromEntries(all('SELECT key,value FROM metadata WHERE scope=?', space).map(row => [row.key, row.value])); break
        default: throw badRequest('未知工作区操作')
      }
      db.exec('COMMIT'); return result
    } catch (error) { db.exec('ROLLBACK'); throw error }
  }
  get<T>(space: string, id: string): T | null {
    const value = this.request({ op: 'kvGet', space, id }) as string | null
    return value === null ? null : JSON.parse(value) as T
  }
  set(space: string, id: string, value: unknown) {
    this.request({ op: 'kvSet', space, id, value: JSON.stringify(value) })
  }
  all<T>(space: string): T[] {
    return Object.values(this.request({ op: 'kvList', space }) as Record<string, string>).map(v => JSON.parse(v) as T)
  }
}
