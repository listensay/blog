import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

interface AutoSaveOptions<T> {
  value: Ref<T>
  read: () => Promise<T>
  write: (value: T) => Promise<T>
  enabled?: () => boolean
  delay?: number
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))
const snapshot = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

function mergeDraft(base: unknown, draft: unknown, remote: unknown): unknown {
  if (JSON.stringify(base) === JSON.stringify(draft)) return remote
  const record = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && !Array.isArray(value)
  if (!record(base) || !record(draft) || !record(remote)) return draft
  return Object.fromEntries(
    [...new Set([...Object.keys(draft), ...Object.keys(remote)])].map((key) => [
      key,
      mergeDraft(base[key], draft[key], remote[key]),
    ]),
  )
}

export function createAutoSave<T>(options: AutoSaveOptions<T>) {
  const loading = ref(true)
  const saving = ref(false)
  const loadError = ref('')
  const saveError = ref('')
  const refreshError = ref('')
  const saved = ref(false)
  const baseline = ref(JSON.stringify(options.value.value))
  const dirty = computed(() => JSON.stringify(options.value.value) !== baseline.value)
  let loaded = false
  let disposed = false
  let refreshPending = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let reading: Promise<void> | undefined
  let writing: Promise<boolean> | undefined

  function apply(value: T, base: T = JSON.parse(baseline.value) as T) {
    const merged = mergeDraft(base, options.value.value, value) as T
    baseline.value = JSON.stringify(value)
    options.value.value = snapshot(merged)
  }

  function clearTimer() {
    clearTimeout(timer)
    timer = undefined
  }

  async function refresh() {
    if (disposed) return
    if (saving.value) {
      refreshPending = true
      return
    }
    if (reading) return reading
    if (!loaded) loading.value = true
    reading = Promise.resolve().then(async () => {
      try {
        const value = await options.read()
        if (disposed) return
        // Merge remote fields while preserving changes made during the request.
        apply(value)
        loaded = true
        loadError.value = ''
        refreshError.value = ''
      } catch (error) {
        if (!disposed) (loaded ? refreshError : loadError).value = errorText(error)
      } finally {
        loading.value = false
        reading = undefined
        if (loaded && dirty.value && !saveError.value && !timer && !disposed) {
          timer = setTimeout(() => {
            void flush()
          }, options.delay ?? 600)
        }
      }
    })
    return reading
  }

  async function flush(): Promise<boolean> {
    clearTimer()
    if (reading) await reading
    if (writing) return writing
    if (!dirty.value) return true
    if (!loaded || options.enabled?.() === false) return false
    saving.value = true
    saveError.value = ''
    writing = Promise.resolve().then(async () => {
      try {
        // Serialize writes and drain newer edits without applying stale responses.
        while (dirty.value && !disposed && options.enabled?.() !== false) {
          try {
            // Rebase before writing even if another window's event is still pending.
            const remote = await options.read()
            if (disposed) return false
            apply(remote)
            refreshError.value = ''
          } catch (error) {
            refreshError.value = errorText(error)
            return false
          }
          if (options.enabled?.() === false) return false
          if (!dirty.value) break
          const value = snapshot(options.value.value)
          let result: T
          try {
            result = await options.write(value)
          } catch (error) {
            saveError.value = errorText(error)
            return false
          }
          if (disposed) return false
          apply(result, value)
          saved.value = true
          try {
            const remote = await options.read()
            if (disposed) return false
            apply(remote)
            refreshError.value = ''
            refreshPending = false
          } catch (error) {
            refreshError.value = errorText(error)
          }
        }
        return !dirty.value
      } finally {
        saving.value = false
        writing = undefined
        if (refreshPending && !dirty.value && !disposed) {
          refreshPending = false
          void refresh()
        }
      }
    })
    return writing
  }

  const stop = watch(
    () => JSON.stringify(options.value.value),
    () => {
      clearTimer()
      if (!loaded || disposed) return
      saveError.value = ''
      if (saving.value || !dirty.value) return
      timer = setTimeout(() => {
        void flush()
      }, options.delay ?? 600)
    },
    { flush: 'sync' },
  )

  function dispose() {
    disposed = true
    clearTimer()
    stop()
  }

  return {
    loading,
    saving,
    dirty,
    saved,
    loadError,
    saveError,
    refreshError,
    refresh,
    flush,
    dispose,
  }
}

export function useAutoSave<T>(options: AutoSaveOptions<T>) {
  const state = createAutoSave(options)
  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (state.dirty.value || state.saving.value) {
      event.preventDefault()
      void state.flush()
    }
  }
  function onKeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      void state.flush()
    }
  }
  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') void state.flush()
  }
  onMounted(() => {
    void state.refresh()
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('keydown', onKeydown)
    document.addEventListener('visibilitychange', onVisibilityChange)
  })
  onBeforeUnmount(() => {
    state.dispose()
    window.removeEventListener('beforeunload', onBeforeUnload)
    window.removeEventListener('keydown', onKeydown)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })
  onBeforeRouteLeave(() => state.flush())
  return state
}
