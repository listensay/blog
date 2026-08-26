
const MAX_STAGGER_INDEX = 6

const REVEALED = 'is-revealed'

let observer: IntersectionObserver | undefined

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

function staggerIndex(value: unknown) {
  const raw = typeof value === 'number' ? value : 0
  return raw > 0 ? String(Math.min(Math.round(raw), MAX_STAGGER_INDEX)) : ''
}

export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.client) {
    document.documentElement.classList.add('reveal-ready')
  }

  nuxtApp.vueApp.directive<HTMLElement, number | undefined>('reveal', {
    getSSRProps() {
      return { 'data-reveal': '' }
    },

    mounted(el, binding) {
      el.dataset.reveal = ''

      const index = staggerIndex(binding.value)
      if (index) el.style.setProperty('--reveal-index', index)

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
