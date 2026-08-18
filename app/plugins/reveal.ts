/**
 * v-reveal —— 元素进入视口时淡入上浮。
 *
 * 用法：`<div v-reveal>`，或 `<li v-for="(x, i) in list" v-reveal="i">`
 * 传序号就会按 --anim-stagger 逐条入场。初始态、过渡、兜底动画都在
 * main.css 的 `[data-reveal]` 里，这里只管「什么时候加 .is-revealed」。
 *
 * 几个刻意的取舍：
 *
 * 1. 初始态（透明 + 下移）通过 getSSRProps 写进服务端 HTML。若改成挂载后再补，
 *    读者会先看到完整内容闪一下、再被藏起来重播一遍，比不做动画更难受。
 * 2. 代价是「HTML 到了但 JS 还没到」的窗口里内容是透明的，所以 CSS 里留了
 *    900ms 的兜底动画。这里在 JS 真正接管的那一刻给 <html> 加 .reveal-ready
 *    撤掉兜底——时机必须是 hydration，不能提前塞个 inline script，
 *    否则弱网下兜底被提前掐掉，正文会一直白着。
 * 3. rootMargin 只往下扩、绝不用负的 bottom：短页面（没有滚动条）底部的元素
 *    会永远等不到滚动，负值会让它们永久隐身。
 * 4. 只显现一次，触发即 unobserve——长列表不留回调，也不会来回闪。
 */

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
  if (import.meta.client) {
    document.documentElement.classList.add('reveal-ready')
  }

  nuxtApp.vueApp.directive<HTMLElement, number | undefined>('reveal', {
    // 服务端只写 data-reveal，初始态交给 CSS。
    // 刻意不在这里输出 --reveal-index 的内联 style：元素自己若有 :style 绑定，
    // 服务端多出来的那条声明会在 dev 下报 hydration style mismatch。序号改在
    // mounted 里补——它在首帧绘制前执行，过渡该有的延迟一样赶得上。
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
