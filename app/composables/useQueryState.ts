import type { AsyncDataRequestStatus } from '#app'

/** 骨架屏的最短展示时长。太快返回时灰块一闪而过，读起来像页面抖了一下，比不做还糟 */
const SKELETON_MIN_MS = 350

// 给「正在加载」加一个最短持续时间。服务端数据是阻塞取的、压根没有加载态，
// 而客户端首帧的值必须和服务端一致，否则报 hydration mismatch
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

// lazy 取数页面共用的状态壳子。'idle' 也算加载中（lazy 请求的第一帧就是它，漏掉会闪下空列表），
// 加上最短展示时长，并把失败冒给 Nuxt 错误页——不然错误会显示成「还没有文章」，那是在骗读者
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
