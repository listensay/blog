import type { AsyncDataRequestStatus } from '#app'

/**
 * 骨架屏的最短展示时长。
 *
 * 没有它，骨架屏基本看不见：本机（乃至线上二次访问）内容查询几十毫秒就回来了，
 * 灰块一闪而过，读者只会觉得页面抖了一下——比不做还糟。所以一旦决定显示骨架屏，
 * 就至少撑住这么久，让它读起来是一个「状态」而不是一次闪烁。
 *
 * 代价是换页最快也要这么久才出内容。嫌慢就把这个数字调小，改成 0 等于关掉。
 */
const SKELETON_MIN_MS = 350

/**
 * 给「正在加载」加一个最短持续时间。
 *
 * 服务端不需要：那边数据是阻塞取的，压根没有加载态。客户端才起作用，
 * 而且首帧的值必须和服务端一致（hydration 时 status 已是 success → false），
 * 否则会报 hydration mismatch。
 */
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

/**
 * lazy 取数页面共用的状态壳子。
 *
 * 本站的页面数据都开了 `lazy: true`：客户端换路由时不阻塞导航，页面先渲染出来、
 * 用骨架屏占位，数据回来再替换。服务端不吃 lazy（useAsyncData 一律走
 * onServerPrefetch 阻塞渲染），所以 SSR 的 HTML 里始终是真内容而不是骨架屏
 * ——整页刷新时看不到骨架屏是对的，那是给搜索引擎和首屏速度让路。
 *
 * 这个函数负责三件事：
 *
 * 1. `loading` —— 'idle' 也要算「还在加载」。lazy 的请求要等 onBeforeMount 才启动，
 *    页面渲染的第一帧状态是 'idle'，只判 'pending' 会漏掉那一帧，看着像闪了下空列表。
 * 2. 给它加最短展示时长，见 SKELETON_MIN_MS。
 * 3. 把失败冒给 Nuxt 错误页。改成 lazy 之前请求是 await 的，出错会中断导航；
 *    lazy 之后错误只会静静躺在 error.value 里，页面会显示成「还没有文章」——
 *    那是在骗读者。
 */
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
