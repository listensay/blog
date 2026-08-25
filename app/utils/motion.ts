// 系统是否开了「减弱动态效果」。CSS 那边由 main.css 兜住，但 scrollTo({ behavior: 'smooth' })
// 是显式参数、会盖掉 CSS 的 scroll-behavior，所以手写平滑滚动的地方都要过这个判断
export function prefersReducedMotion() {
  if (import.meta.server || typeof matchMedia === 'undefined') return false
  return matchMedia('(prefers-reduced-motion: reduce)').matches
}
