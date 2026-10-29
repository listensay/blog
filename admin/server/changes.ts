import { watch, type FSWatcher } from 'node:fs'
import type { ServerResponse } from 'node:http'
import type { Workspace } from './paths.ts'

export class WorkspaceChanges {
  private clients = new Set<ServerResponse>()
  private watchers: FSWatcher[]
  private timer?: ReturnType<typeof setTimeout>

  constructor(ws: Workspace) {
    this.watchers = [ws.contentDir, ws.publicDir].map((directory) =>
      watch(directory, { recursive: true }, (_event, filename) => {
        if (filename?.endsWith('.DS_Store')) return
        clearTimeout(this.timer)
        this.timer = setTimeout(() => {
          for (const client of this.clients) client.write('data: changed\n\n')
        }, 200)
      }),
    )
  }

  connect(response: ServerResponse) {
    response.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    })
    response.write(': connected\n\n')
    this.clients.add(response)
    const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 15000)
    response.once('close', () => {
      clearInterval(heartbeat)
      this.clients.delete(response)
    })
  }

  close() {
    clearTimeout(this.timer)
    this.watchers.forEach((watcher) => watcher.close())
    this.clients.forEach((client) => client.end())
    this.clients.clear()
  }
}
