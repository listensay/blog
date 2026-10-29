import { onBeforeUnmount, onMounted } from 'vue'

const listeners = new Set<() => void>()
let source: EventSource | undefined

export function useDataRefresh(refresh: () => void | Promise<unknown>, active = () => true) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false
  let pending = false
  let disposed = false

  async function run() {
    if (disposed || !active()) return
    if (running) {
      pending = true
      return
    }
    running = true
    try {
      do {
        pending = false
        await refresh()
      } while (pending && !disposed && active())
    } finally {
      running = false
    }
  }
  function schedule() {
    clearTimeout(timer)
    timer = setTimeout(() => {
      void run()
    }, 200)
  }
  function onFocus() {
    if (document.visibilityState === 'visible') schedule()
  }
  onMounted(() => {
    listeners.add(schedule)
    if (!source) {
      source = new EventSource('/api/events')
      source.onmessage = source.onopen = () => listeners.forEach((listener) => listener())
    }
    window.addEventListener('focus', onFocus)
  })
  onBeforeUnmount(() => {
    disposed = true
    clearTimeout(timer)
    listeners.delete(schedule)
    window.removeEventListener('focus', onFocus)
    if (!listeners.size) {
      source?.close()
      source = undefined
    }
  })
}
