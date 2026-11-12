import { invoke, isTauri } from '@tauri-apps/api/core'

const pendingSaves = new Set<() => Promise<boolean | void>>()
let syncContent: (() => Promise<unknown>) | undefined
export function registerDesktopSync(sync: () => Promise<unknown>) {
  syncContent = sync
  return () => {
    if (syncContent === sync) syncContent = undefined
  }
}
export function registerDesktopSave(save: () => Promise<boolean | void>) {
  pendingSaves.add(save)
  return () => pendingSaves.delete(save)
}
export async function flushDesktopSaves() {
  for (const save of pendingSaves) {
    if ((await save()) === false) throw new Error('修改尚未保存，请检查表单或重试。')
  }
  await syncContent?.()
}
export async function chooseWorkspace() {
  await flushDesktopSaves()
  await invoke('choose_workspace')
}
export function installDesktopClose(onError: (message: string) => void) {
  if (!isTauri()) return
  const host = window as Window & { __BLOG_DESKTOP_CLOSE__?: () => Promise<void> }
  host.__BLOG_DESKTOP_CLOSE__ = async () => {
    let saved = false
    document.documentElement.inert = true
    try {
      await flushDesktopSaves()
      saved = true
    } catch (error) {
      onError(error instanceof Error ? error.message : '保存失败，请重试。')
    } finally {
      document.documentElement.inert = false
    }
    await invoke('finish_close', { saved }).catch((error) => onError(String(error)))
  }
}
