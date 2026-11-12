import { execFile } from 'node:child_process'
import { access, lstat, readFile, realpath } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { promisify } from 'node:util'
import { atomicWrite, stateDir } from './affine/config.ts'
import type { Workspace } from './paths.ts'
import type { GitSyncStatus } from '../src/types.ts'

const exec = promisify(execFile)
const COMMIT_SUBJECT = 'content: 更新博客内容'
const permitted = (file: string) =>
  /^(?:content\/(?:blog|pages|journals)\/.+\.md|content\/data\/(?:site|nav|projects)\.json|public\/(?:images|affine-assets)\/[^/]+)$/.test(
    file,
  ) &&
  !file.split('/').some((part) => part === '..' || part === '.') &&
  !/[\0\r\n\\]/.test(file)

interface Target {
  branch: string
  remote: string
  ref: string
}
interface Pending {
  version: 1
  files: Record<string, string>
  target: Target | null
  needsPush: boolean
  lastSyncedAt: string | null
}

export class ContentGitSync {
  private readonly ws: Workspace
  private readonly file: string
  private readonly changed: (status: GitSyncStatus) => void
  private readonly delay: number
  private pending: Pending = {
    version: 1,
    files: {},
    target: null,
    needsPush: false,
    lastSyncedAt: null,
  }
  private status: GitSyncStatus = { phase: 'idle', error: '', lastSyncedAt: null }
  private queue: Promise<unknown> = Promise.resolve()
  private readonly ready: Promise<void>
  private running?: Promise<void>
  private timer?: ReturnType<typeof setTimeout>
  private stopped = false
  private loadError = ''
  private readonly abort = new AbortController()

  constructor(ws: Workspace, changed = (_status: GitSyncStatus) => {}, delay = 2000) {
    this.ws = ws
    this.file = path.join(stateDir(ws), 'git-sync.json')
    this.changed = changed
    this.delay = delay
    this.ready = this.load()
  }

  private async load() {
    try {
      const raw = await readFile(this.file, 'utf8').catch((error) => {
        if (error.code === 'ENOENT') return null
        throw error
      })
      if (raw) {
        const saved = JSON.parse(raw) as Pending
        if (
          saved.version !== 1 ||
          !saved.files ||
          typeof saved.files !== 'object' ||
          Array.isArray(saved.files) ||
          Object.entries(saved.files).some(
            ([file, version]) => !permitted(file) || typeof version !== 'string',
          ) ||
          typeof saved.needsPush !== 'boolean' ||
          (saved.lastSyncedAt !== null && typeof saved.lastSyncedAt !== 'string') ||
          (saved.target !== null &&
            (!saved.target ||
              !['branch', 'remote', 'ref'].every(
                (key) => typeof saved.target?.[key as keyof Target] === 'string',
              )))
        )
          throw new Error('同步记录无效')
        this.pending = saved
      }
      this.setStatus(this.hasPending() ? 'pending' : this.pending.lastSyncedAt ? 'synced' : 'idle')
      if (this.hasPending()) this.schedule()
    } catch {
      this.loadError = '无法读取待推送记录，请检查 .affine/git-sync.json 后重新打开后台。'
      this.setStatus('error', this.loadError)
    }
  }

  private exclusive<T>(action: () => Promise<T>): Promise<T> {
    const operation = this.queue.then(action)
    this.queue = operation.catch(() => {})
    return operation
  }

  private hasPending() {
    return this.pending.needsPush || Object.keys(this.pending.files).length > 0
  }

  private setStatus(phase: GitSyncStatus['phase'], error = '') {
    this.status = { phase, error, lastSyncedAt: this.pending.lastSyncedAt }
    this.changed(this.status)
  }

  private persist() {
    return atomicWrite(this.file, JSON.stringify(this.pending))
  }

  private schedule(delay = this.delay) {
    clearTimeout(this.timer)
    if (this.stopped) return
    this.timer = setTimeout(() => {
      void this.flush().catch(() => {})
    }, delay)
    this.timer.unref()
  }

  async readStatus() {
    await this.ready
    return this.status
  }

  // Serialize file writes with commit creation; a slow push does not block local saves.
  async save<T>(action: (files: string[]) => Promise<T>): Promise<T> {
    await this.ready
    return this.exclusive(async () => {
      if (this.stopped) throw new Error('后台正在关闭')
      if (this.loadError) throw new Error(this.loadError)
      const files: string[] = []
      const result = await action(files)
      for (const absolute of files) {
        const file = path.relative(this.ws.blogRoot, absolute).split(path.sep).join('/')
        if (!permitted(file)) throw new Error(`无法同步此内容路径：${file}`)
        this.pending.files[file] = randomUUID()
      }
      if (files.length) {
        await this.persist()
        if (!['committing', 'pushing'].includes(this.status.phase)) this.setStatus('pending')
        this.schedule()
      }
      return result
    })
  }

  private async git(args: string[], input?: string) {
    const env = { ...process.env }
    // Finder-launched macOS apps do not inherit the terminal's executable search path.
    if (process.platform !== 'win32')
      env.PATH = [
        env.PATH,
        '/opt/homebrew/bin',
        '/usr/local/bin',
        '/usr/bin',
        '/bin',
        '/usr/sbin',
        '/sbin',
      ]
        .filter(Boolean)
        .join(path.delimiter)
    env.GIT_TERMINAL_PROMPT = '0'
    env.GCM_INTERACTIVE = 'never'
    env.GIT_SSH_COMMAND ||= 'ssh -o BatchMode=yes'
    env.LC_ALL = 'C'
    const operation = exec('git', ['--literal-pathspecs', ...args], {
      cwd: this.ws.blogRoot,
      env,
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
      timeout: 60000,
      signal: this.abort.signal,
      windowsHide: true,
    })
    operation.child.stdin?.end(input)
    return (await operation).stdout
  }

  private async target(): Promise<Target> {
    const root = (await this.git(['rev-parse', '--show-toplevel'])).trim()
    if ((await realpath(root)) !== (await realpath(this.ws.blogRoot)))
      throw new Error('博客目录必须是 Git 仓库根目录。')
    const branch = (await this.git(['symbolic-ref', '--quiet', 'HEAD'])).trim()
    for (const name of [
      'MERGE_HEAD',
      'CHERRY_PICK_HEAD',
      'REVERT_HEAD',
      'rebase-merge',
      'rebase-apply',
    ]) {
      const file = (await this.git(['rev-parse', '--git-path', name])).trim()
      if (
        await access(path.resolve(this.ws.blogRoot, file)).then(
          () => true,
          () => false,
        )
      )
        throw new Error('Git 合并或变基尚未完成，请先处理后重试同步。')
    }
    const [remote, ref] = (
      await this.git([
        'for-each-ref',
        '--format=%(upstream:remotename)%00%(upstream:remoteref)',
        branch,
      ])
    )
      .trim()
      .split('\0')
    if (!remote || remote === '.' || !ref?.startsWith('refs/heads/'))
      throw new Error('当前分支未设置远程上游，请先设置 Git 上游分支，再重试同步。')
    const target = { branch, remote, ref }
    if (this.pending.target && JSON.stringify(target) !== JSON.stringify(this.pending.target))
      throw new Error('分支或远程配置已改变，请恢复待推送内容原来的分支和上游后重试。')
    return target
  }

  private async prepare() {
    if (!this.hasPending()) return null
    this.setStatus('committing')
    const target = await this.target()
    const batch = { ...this.pending.files }
    const files = Object.keys(batch)
    for (const file of files) {
      for (
        let current = path.join(this.ws.blogRoot, file);
        current !== this.ws.blogRoot;
        current = path.dirname(current)
      ) {
        if (
          (
            await lstat(current).catch((error) => {
              if (error.code === 'ENOENT') return null
              throw error
            })
          )?.isSymbolicLink()
        )
          throw new Error(`内容路径不能是符号链接：${file}`)
      }
    }
    const changes = files.length
      ? (
          await this.git([
            'status',
            '--porcelain=v1',
            '-z',
            '--untracked-files=all',
            '--ignored=matching',
            '--no-renames',
            '--',
            ...files,
          ])
        )
          .split('\0')
          .filter(Boolean)
      : []
    if (changes.some((entry) => /U|AA|DD/.test(entry.slice(0, 2))))
      throw new Error('内容存在 Git 冲突，请先解决冲突后重试同步。')
    if (changes.some((entry) => entry.startsWith('!!')))
      throw new Error('内容文件被 Git 忽略，请调整忽略规则后重试同步。')
    const changedFiles = changes.map((entry) => entry.slice(3)).filter((file) => file in batch)
    if (changedFiles.length) {
      this.pending.target = target
      await this.persist()
      const pathspec = changedFiles.join('\0') + '\0'
      await this.git(['add', '-A', '--pathspec-from-file=-', '--pathspec-file-nul'], pathspec)
      const staged = (
        await this.git(['diff', '--cached', '--name-only', '-z', 'HEAD', '--', ...changedFiles])
      )
        .split('\0')
        .filter(Boolean)
      if (staged.length) {
        // Persist the intent before committing so a restart can retry a completed commit's push.
        this.pending.needsPush = true
        await this.persist()
        const message = `${COMMIT_SUBJECT}\n\n后台管理自动提交\n\n变更文件：\n${staged.map((file) => `- ${file}`).join('\n')}`
        // --only keeps unrelated staged files out of the commit and preserves their staging.
        await this.git(
          ['commit', '--only', '-m', message, '--pathspec-from-file=-', '--pathspec-file-nul'],
          staged.join('\0') + '\0',
        )
      }
    }
    if (!this.pending.needsPush) {
      this.pending.files = {}
      this.pending.target = null
      await this.persist()
      this.setStatus(this.pending.lastSyncedAt ? 'synced' : 'idle')
      return null
    }
    const commit = (await this.git(['rev-parse', 'HEAD'])).trim()
    return { batch, target, commit }
  }

  async flush(): Promise<void> {
    await this.ready
    clearTimeout(this.timer)
    if (this.loadError) throw new Error(this.loadError)
    if (this.stopped) return
    if (this.running) return this.running
    this.running = (async () => {
      try {
        while (!this.stopped) {
          const next = await this.exclusive(() => this.prepare())
          if (!next) break
          this.setStatus('pushing')
          await this.target()
          await this.git([
            '-c',
            'push.followTags=false',
            'push',
            '--porcelain',
            '--',
            next.target.remote,
            `${next.commit}:${next.target.ref}`,
          ])
          await this.exclusive(async () => {
            for (const [file, version] of Object.entries(next.batch))
              if (this.pending.files[file] === version) delete this.pending.files[file]
            this.pending.needsPush = false
            this.pending.lastSyncedAt = new Date().toISOString()
            if (!this.hasPending()) this.pending.target = null
            await this.persist()
            this.setStatus(this.hasPending() ? 'pending' : 'synced')
          })
        }
      } catch (error) {
        const message = this.errorMessage(error)
        if (!this.stopped) {
          this.setStatus('error', message)
          this.schedule(30000)
        }
        throw new Error(message)
      } finally {
        this.running = undefined
      }
    })()
    return this.running
  }

  private errorMessage(error: unknown) {
    const detail = error as {
      code?: string
      stdout?: string
      stderr?: string
      message?: string
      killed?: boolean
    }
    const text =
      detail.stdout || detail.stderr
        ? `${detail.stderr || ''}\n${detail.stdout || ''}`
        : detail.message || String(error)
    const prefix = '内容已保存在本地，尚未推送。'
    if (detail.code === 'ENOENT') return `${prefix}未找到 Git，请安装 Git 后重试。`
    if (/not a git repository/i.test(text)) return `${prefix}博客目录不是 Git 仓库。`
    if (/not currently on a branch|symbolic-ref/.test(text))
      return `${prefix}请先切换到有远程上游的 Git 分支。`
    if (/identity unknown|unable to auto-detect email/i.test(text))
      return `${prefix}请先配置 Git 用户名和邮箱。`
    if (/non-fast-forward|fetch first|\[rejected\]/i.test(text))
      return `${prefix}远程分支有新提交，请先拉取并合并后重试。`
    if (
      /authentication|permission denied|could not read Username|terminal prompts disabled|repository not found/i.test(
        text,
      )
    )
      return `${prefix}Git 认证失败，请检查远程仓库的访问权限和凭据。`
    if (
      /could not resolve|unable to access|failed to connect|connection|timed out/i.test(text) ||
      detail.killed
    )
      return `${prefix}无法连接远程仓库，请检查网络后重试。`
    if (/index\.lock|another git process/i.test(text))
      return `${prefix}Git 正被其他操作占用，请稍后重试。`
    // Keep repository URLs and credential-helper output out of the interface.
    if (detail.stderr !== undefined) return `${prefix}Git 操作失败，请在终端检查仓库状态后重试。`
    return `${prefix}${text}`
  }

  async close() {
    this.stopped = true
    clearTimeout(this.timer)
    this.abort.abort()
    await this.ready
    await this.running?.catch(() => {})
    await this.queue
  }
}
