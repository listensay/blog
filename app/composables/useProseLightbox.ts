// 给正文里的图片加灯箱（lightGallery）：把 prose 容器的模板 ref 传进来，只有真的有图才 import。
// 字幕只取 title 不取 alt（alt 是 Typora 生成的文件名）；licenseKey 填 GPLv3 才不报生产环境警告

type Gallery = ReturnType<typeof import('lightgallery').default>

export function useProseLightbox(container: Ref<HTMLElement | undefined | null>) {
  // 服务端没有 DOM，整段都不该进服务端产物
  if (import.meta.server) return

  let gallery: Gallery | undefined
  /** 已经初始化、或正在初始化的那个元素 */
  let current: HTMLElement | undefined
  /** 等正文图片进 DOM 的观察器，见 start() */
  let observer: MutationObserver | undefined
  /** 每次 teardown 自增，用来作废还卡在 await 里的那次 init */
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

  // 容器出现的那一刻正文可能还是空的：MDCRenderer 是异步组件，DOM 要等 Suspense 解析完才落地，
  // 那时 querySelectorAll('img') 是 0 个。所以有图就直接初始化，没图就盯着容器等图片进来
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

    // 先占位，避免 await 期间重复进来
    current = el
    const gen = ++generation

    for (const img of images) {
      // lightGallery 从 data-src 取要放大的图。正文里插的本来就是原图，
      // 用 getAttribute 而不是 img.src：后者会被浏览器补成绝对地址
      const src = img.getAttribute('src') ?? img.currentSrc
      img.dataset.src = src
      // 缩略图条读 data-thumb，且不会回退到 data-src：不设的话缩略图条照样渲染，
      // 但里面每个 img 都是 src=""，一片空白。站里没有图片变体，直接复用原图
      img.dataset.thumb = src
      const title = img.getAttribute('title')
      if (title) img.dataset.subHtml = title
    }

    const [lg, zoom, thumbnail, fullscreen] = await Promise.all([
      import('lightgallery'),
      import('lightgallery/plugins/zoom'),
      import('lightgallery/plugins/thumbnail'),
      import('lightgallery/plugins/fullscreen'),
      // CSS 一起并进这批动态 import，Vite 会把它们拆成同一个 chunk 的样式
      import('lightgallery/css/lightgallery.css'),
      import('lightgallery/css/lg-zoom.css'),
      import('lightgallery/css/lg-thumbnail.css'),
      import('lightgallery/css/lg-fullscreen.css'),
    ])

    // 等待期间组件可能已经卸载，或者被 teardown 过（generation 会变）
    if (disposed || gen !== generation) return

    gallery = lg.default(el, {
      selector: 'img',
      plugins: [zoom.default, thumbnail.default, fullscreen.default],
      licenseKey: 'GPLv3',
      // 缩略图来源，不能省：gallery item 本身就是 <img>，lightGallery 默认去找后代 img，
      // 找不到 thumb 就是空字符串。光设 data-thumb 也没用，得在这里显式指过去
      exThumbImage: 'data-thumb',
      // 下载按钮对截图没什么意义，工具栏留干净些
      download: false,
      // 手机上默认连关闭按钮都不给（只能下滑关闭），太不好发现了
      mobileSettings: { controls: true, showCloseIcon: true, download: false },
      speed: prefersReducedMotion() ? 0 : 260,
    })

    // 有灯箱了才给放大镜光标——手势提示要和实际能力同时出现
    el.classList.add('lightbox-ready')
  }

  watch(container, (el) => {
    // 元素没变说明 onMounted 那条路已经在处理了，绝不能再 teardown：那会清空 current，
    // 让紧接着的 init 绕过幂等判断挂上第二个实例，一点缩略图就能看到两张图叠在一起
    if (el === current) return
    teardown()
    if (el) start(el)
  }, { flush: 'post' })

  onMounted(() => {
    // 直接打开/刷新文章页时数据来自 payload，容器首帧就在，这里和上面的 watch
    // 会都拿到同一个元素；靠 init 内部的 current === el 幂等判断收口
    if (container.value) start(container.value)
  })

  onBeforeUnmount(() => {
    disposed = true
    teardown()
  })
}
