// v-reveal —— 元素进入视口时淡入上浮，`<div v-reveal>`，传序号则按 --anim-stagger 逐条入场。
// 初始态、过渡、兜底动画都在 main.css；rootMargin 的 bottom 不能用负值，短页面底部会永久隐身

/** 序号上限：第 30 条不该等 1.6 秒才出现，超过就并进最后一批 */
const MAX_STAGGER_INDEX = 6

const REVEALED = 'is-revealed'

/** 全站共用一个 observer，几百个元素也只有一份回调 */
let observer: IntersectionObserver | undefined

/** 元素 → 显现动作。WeakMap 存，元素被丢弃时自动回收 */
const watched = new WeakMap<Element, () => void>()

function getObserver() {
  observer ??= new IntersectionObserver(
    (entries, self) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        self.unobserve(entry.target)
        watched.get(entry.target)?.()
        watched.delete(entry.target)
      }
    },
    { rootMargin: '0px 0px 8% 0px', threshold: 0 },
  )
  return observer
}

/** 序号 → CSS 变量值；没传或为 0 就不写，省一个内联样式 */
function staggerIndex(value: unknown) {
  const raw = typeof value === 'number' ? value : 0
  return raw > 0 ? String(Math.min(Math.round(raw), MAX_STAGGER_INDEX)) : ''
}

export default defineNuxtPlugin((nuxtApp) => {
  // 走到这里说明 hydration 已经开始，JS 可以接管了：撤掉 CSS 兜底
  // 别提前到 inline script 里做：弱网下兜底被提早掐掉，正文会一直白着
  if (import.meta.client) {
    document.documentElement.classList.add('reveal-ready')
  }

  nuxtApp.vueApp.directive<HTMLElement, number | undefined>('reveal', {
    // 服务端只写 data-reveal，初始态交给 CSS。刻意不输出 --reveal-index 内联 style：
    // 元素自己有 :style 绑定时 dev 下会报 hydration style mismatch，序号改在 mounted 里补
    getSSRProps() {
      return { 'data-reveal': '' }
    },

    mounted(el, binding) {
      el.dataset.reveal = ''

      const index = staggerIndex(binding.value)
      if (index) el.style.setProperty('--reveal-index', index)

      // 老浏览器没有 IntersectionObserver：直接显示，不留隐藏元素
      if (typeof IntersectionObserver === 'undefined') {
        el.classList.add(REVEALED)
        return
      }

      watched.set(el, () => el.classList.add(REVEALED))
      getObserver().observe(el)
    },

    beforeUnmount(el) {
      if (!watched.has(el)) return
      watched.delete(el)
      observer?.unobserve(el)
    },
  })
})
