import assert from 'node:assert/strict'
import { ref } from 'vue'
import { clearMocks, mockIPC } from '@tauri-apps/api/mocks'
import { createAutoSave } from '../src/composables/useAutoSave.ts'
import {
  chooseWorkspace,
  flushDesktopSaves,
  installDesktopClose,
  registerDesktopSave,
} from '../src/desktop.ts'

const pause = (ms = 25) => new Promise((resolve) => setTimeout(resolve, ms))
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
function model(text: string) {
  return { text }
}

{
  let remote = model('original')
  const value = ref(model(''))
  const writes: string[] = []
  let reads = 0
  const state = createAutoSave({
    value,
    delay: 10,
    read: async () => {
      reads++
      return { ...remote }
    },
    write: async (next) => {
      writes.push(next.text)
      remote = next
      return next
    },
  })
  try {
    await state.refresh()
    await pause()
    assert.equal(writes.length, 0, 'loading must not save')
    value.value.text = 'first'
    value.value.text = 'latest'
    await pause()
    assert.deepEqual(writes, ['latest'], 'debounce consecutive edits')
    assert.equal(reads, 3, 'rebase before writing and re-read after saving')
    assert.equal(state.dirty.value, false)
    assert.equal(state.saved.value, true)
    assert.equal(value.value.text, 'latest')
    assert.notEqual(value.value, remote, 'avoid mutating the response object')
  } finally {
    state.dispose()
  }
}

{
  let remote = model('original')
  const value = ref(model(''))
  const gate = deferred<{ text: string }>()
  const writes: string[] = []
  const state = createAutoSave({
    value,
    delay: 10000,
    read: async () => ({ ...remote }),
    write: async (next) => {
      writes.push(next.text)
      if (writes.length === 1) await gate.promise
      remote = model(next.text.trim())
      return { ...remote }
    },
  })
  try {
    await state.refresh()
    value.value.text = ' first '
    const first = state.flush()
    await pause()
    value.value.text = ' second '
    const second = state.flush()
    gate.resolve(model(''))
    assert.equal(await first, true)
    assert.equal(await second, true)
    assert.deepEqual(writes, [' first ', ' second '], 'serialize and drain newer edits')
    assert.equal(value.value.text, 'second', 'apply only the latest normalized response')
    assert.equal(state.dirty.value, false)
  } finally {
    state.dispose()
  }
}

{
  const value = ref(model(''))
  const gate = deferred<{ text: string }>()
  let reads = 0
  const state = createAutoSave({
    value,
    delay: 10000,
    read: async () => (++reads === 1 ? model('original') : gate.promise),
    write: async (next) => next,
  })
  try {
    await state.refresh()
    const refreshing = state.refresh()
    await pause()
    value.value.text = 'draft'
    gate.resolve(model('remote'))
    await refreshing
    assert.equal(value.value.text, 'draft', 'background reads preserve edits')
    assert.equal(state.dirty.value, true)
  } finally {
    state.dispose()
  }
}

{
  let remote = model('original')
  let failing = true
  let readFailure = false
  let writes = 0
  const value = ref(model(''))
  const state = createAutoSave({
    value,
    delay: 10000,
    read: () => {
      if (readFailure) throw new Error('read failed')
      return Promise.resolve({ ...remote })
    },
    write: (next) => {
      writes++
      if (failing) throw new Error('save failed')
      remote = next
      readFailure = true
      return Promise.resolve(next)
    },
  })
  try {
    await state.refresh()
    value.value.text = 'draft'
    assert.equal(await state.flush(), false)
    assert.equal(state.saveError.value, 'save failed')
    assert.equal(state.dirty.value, true)
    assert.equal(value.value.text, 'draft')
    failing = false
    assert.equal(await state.flush(), true)
    assert.equal(state.saveError.value, '')
    assert.equal(state.refreshError.value, 'read failed')
    assert.equal(state.dirty.value, false, 'a failed re-read is not a failed save')
    assert.equal(writes, 2)
    readFailure = false
    await state.refresh()
    assert.equal(state.refreshError.value, '')
    assert.equal(writes, 2, 'retrying reads must not resave')
  } finally {
    state.dispose()
  }
}

{
  let remote = { profile: { name: 'original' }, site: { title: 'original' } }
  const value = ref({ profile: { name: '' }, site: { title: '' } })
  const state = createAutoSave({
    value,
    delay: 10000,
    read: async () => structuredClone(remote),
    write: async (next) => {
      remote = next
      return next
    },
  })
  try {
    await state.refresh()
    value.value.profile.name = 'local draft'
    remote.site.title = 'remote change'
    await state.refresh()
    assert.equal(value.value.profile.name, 'local draft')
    assert.equal(value.value.site.title, 'remote change', 'refresh unedited fields in a dirty form')
    assert.equal(await state.flush(), true)
    assert.equal(remote.site.title, 'remote change', 'saving a draft retains refreshed fields')
  } finally {
    state.dispose()
  }
}

{
  let writes = 0
  let broken = true
  const value = ref(model(''))
  const state = createAutoSave({
    value,
    delay: 10,
    enabled: () => !broken,
    read: async () => model('original'),
    write: async (next) => {
      writes++
      return next
    },
  })
  try {
    await state.refresh()
    value.value.text = 'draft'
    await pause()
    assert.equal(writes, 0, 'do not overwrite an invalid source file')
    broken = false
    await state.refresh()
    await pause()
    assert.equal(writes, 1, 'resume after the source file is repaired')
    value.value.text = 'discarded after disposal'
    state.dispose()
    await pause()
    assert.equal(writes, 1, 'cancel scheduled writes on disposal')
  } finally {
    state.dispose()
  }
}

console.log('✓ 自动保存防抖、串行写入、过期响应保护、保存后重读、失败重试与卸载清理')

{
  let saved = false
  const unregister = registerDesktopSave(async () => saved)
  await assert.rejects(flushDesktopSaves(), /尚未保存/)
  saved = true
  await flushDesktopSaves()
  unregister()
  const reject = registerDesktopSave(async () => {
    throw new Error('editor write failed')
  })
  await assert.rejects(flushDesktopSaves(), /editor write failed/)
  reject()
  await flushDesktopSaves()
  console.log('✓ 桌面退出等待保存、写入失败阻止退出、卸载后不再等待')
}

{
  const originals = new Map(
    ['window', 'document', 'isTauri'].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  )
  const host: { __BLOG_DESKTOP_CLOSE__?: () => Promise<void> } = {}
  const element = { inert: false }
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: host },
    document: { configurable: true, value: { documentElement: element } },
    isTauri: { configurable: true, value: true },
  })
  const calls: { command: string; args: unknown }[] = []
  const errors: string[] = []
  const gate = deferred<boolean>()
  let fail = false
  const unregister = registerDesktopSave(async () => {
    if (fail) throw new Error('editor write failed')
    return gate.promise
  })
  try {
    mockIPC((command, args) => {
      calls.push({ command, args })
    })
    installDesktopClose((message) => errors.push(message))
    assert.ok(host.__BLOG_DESKTOP_CLOSE__)
    const closing = host.__BLOG_DESKTOP_CLOSE__()
    await pause()
    assert.equal(element.inert, true, 'prevent new edits while closing')
    assert.deepEqual(calls, [], 'do not exit while an editor is still saving')
    gate.resolve(true)
    await closing
    assert.equal(element.inert, false)
    assert.deepEqual(calls, [{ command: 'finish_close', args: { saved: true } }])

    fail = true
    await host.__BLOG_DESKTOP_CLOSE__()
    assert.equal(element.inert, false, 'restore editing after a failed save')
    assert.deepEqual(calls.at(-1), { command: 'finish_close', args: { saved: false } })
    assert.deepEqual(errors, ['editor write failed'])
    await assert.rejects(chooseWorkspace(), /editor write failed/)
    assert.equal(calls.length, 2, 'a failed save also prevents switching blogs')
    fail = false
    await chooseWorkspace()
    assert.equal(calls.at(-1)?.command, 'choose_workspace')
    console.log('✓ 原生退出先完成保存、失败恢复编辑，以及切换博客前保存')
  } finally {
    unregister()
    clearMocks()
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else Reflect.deleteProperty(globalThis, name)
    }
  }
}
