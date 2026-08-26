
type Gallery = ReturnType<typeof import('lightgallery').default>

export function useProseLightbox(container: Ref<HTMLElement | undefined | null>) {
  if (import.meta.server) return

  let gallery: Gallery | undefined
  let current: HTMLElement | undefined
  let observer: MutationObserver | undefined
  let generation = 0
  let disposed = false

  function stopObserving() {
    observer?.disconnect()
    observer = undefined
  }

  function teardown() {
    generation++
    stopObserving()
    gallery?.destroy()
    gallery = undefined
    current = undefined
  }

  function start(el: HTMLElement) {
    if (el.querySelector('img')) {
      init(el)
      return
    }

    stopObserving()
    observer = new MutationObserver(() => {
      if (!el.querySelector('img')) return
      stopObserving()
      init(el)
    })
    observer.observe(el, { childList: true, subtree: true })
  }

  async function init(el: HTMLElement) {
    if (current === el) return

    const images = [...el.querySelectorAll<HTMLImageElement>('img')]
    if (!images.length) return

    current = el
    const gen = ++generation

    for (const img of images) {
      const src = img.getAttribute('src') ?? img.currentSrc
      img.dataset.src = src
      img.dataset.thumb = src
      const title = img.getAttribute('title')
      if (title) img.dataset.subHtml = title
    }

    const [lg, zoom, thumbnail, fullscreen] = await Promise.all([
      import('lightgallery'),
      import('lightgallery/plugins/zoom'),
      import('lightgallery/plugins/thumbnail'),
      import('lightgallery/plugins/fullscreen'),
      import('lightgallery/css/lightgallery.css'),
      import('lightgallery/css/lg-zoom.css'),
      import('lightgallery/css/lg-thumbnail.css'),
      import('lightgallery/css/lg-fullscreen.css'),
    ])

    if (disposed || gen !== generation) return

    gallery = lg.default(el, {
      selector: 'img',
      plugins: [zoom.default, thumbnail.default, fullscreen.default],
      licenseKey: 'GPLv3',
      exThumbImage: 'data-thumb',
      download: false,
      mobileSettings: { controls: true, showCloseIcon: true, download: false },
      speed: prefersReducedMotion() ? 0 : 260,
    })

    el.classList.add('lightbox-ready')
  }

  watch(container, (el) => {
    if (el === current) return
    teardown()
    if (el) start(el)
  }, { flush: 'post' })

  onMounted(() => {
    if (container.value) start(container.value)
  })

  onBeforeUnmount(() => {
    disposed = true
    teardown()
  })
}
