import type { AsyncDataRequestStatus } from '#app'

const SKELETON_MIN_MS = 350

export function useLoadingHold(busy: Ref<boolean>): ComputedRef<boolean> {
  if (import.meta.server) return computed(() => busy.value)

  const held = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  let shownAt = 0

  watch(busy, (isBusy) => {
    clearTimeout(timer)

    if (isBusy) {
      held.value = true
      shownAt = Date.now()
      return
    }

    const rest = SKELETON_MIN_MS - (Date.now() - shownAt)
    if (rest <= 0) {
      held.value = false
      return
    }
    timer = setTimeout(() => {
      held.value = false
    }, rest)
  }, { immediate: true })

  onScopeDispose(() => clearTimeout(timer))

  return computed(() => busy.value || held.value)
}

export function useQueryState(
  status: Ref<AsyncDataRequestStatus>,
  error?: Ref<Error | undefined | null>,
) {
  if (import.meta.client && error) {
    watch(error, (e) => {
      if (e) showError(e)
    }, { immediate: true })
  }

  const busy = computed(() => status.value === 'idle' || status.value === 'pending')

  return { loading: useLoadingHold(busy) }
}
