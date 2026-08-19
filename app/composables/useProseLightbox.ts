/**
 * 给正文里的图片加灯箱（lightGallery）。
 *
 * 用法：把 prose 容器的模板 ref 传进来
 *   const proseEl = ref<HTMLElement>()
 *   useProseLightbox(proseEl)
 *
 * 几个刻意的取舍：
 *
 * 1. **按需加载**：只有正文里真的有图才会去 import lightGallery（约 40KB + CSS）。
 *    纯文字的文章一个字节都不下。
 * 2. **监听容器而不是只用 onMounted**：文章页的正文在 `v-else-if="post"` 里，
 *    前端跳转过来时先渲染的是骨架屏（见 useQueryState），那一刻容器还不存在、
 *    图片更没有。所以要等 ref 真正拿到元素再初始化。
 * 3. **字幕只取 title，不取 alt**：本站的 alt 是 Typora 粘贴时自动生成的文件名
 *    （image-20260814151525775），拿它当字幕只会在灯箱底部显示一串时间戳。
 *    想要字幕就在 Markdown 里写 `![](x.png "这是说明")`。
 * 4. **licenseKey 填 'GPLv3'**：lightGallery 是 GPLv3 / 商业双许可，默认的
 *    '0000-0000-000-0000' 会在控制台警告「not valid for production use」。
 *    本站按 GPLv3 使用，这里如实标注即可消除警告。
 */

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

  /**
   * 容器出现的那一刻，正文可能还是空的。
   *
   * @nuxtjs/mdc 的 MDCRenderer（ContentRenderer 内部用的那个）setup 里有顶层
   * await，是个异步组件：前端跳转时父组件 patch 出 `<div class="prose-cn">` 之后，
   * 它的 DOM 要等 Suspense 解析完才落地，比 flush:'post' 的 watch 更晚。
   * 于是那一刻 querySelectorAll('img') 是 0 个——直接 return 就再也没人重试了，
   * 表现为「站内点进文章点图没反应，刷新一下就好」（刷新走 SSR，图片本来就在 HTML 里）。
   *
   * 所以：有图就直接初始化，没图就盯着容器等图片进来。
   */
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
      // 缩略图条读的是 data-thumb，而且**没有**回退到 data-src：不设的话
      // 缩略图条会照样渲染出来，但里面 6 个 img 全是 src=""，一片空白。
      // 站里没有图片变体，直接复用原图——正文里已经加载过，缓存能命中
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
      // 缩略图的来源。这条不能省：lightGallery 的 selector 模式原本是为
      // `<a data-src="大图"><img src="缩略图">` 这种结构设计的，缩略图取的是
      //   thumb = exThumbImage ? item.attr(exThumbImage) : item.find('img').first().attr('src')
      // 我们的 gallery item 本身就是 <img>，find('img') 找不到后代，thumb 会是
      // 空字符串——表现为缩略图条正常出现、但里面每个 img 的 src 都是空的。
      // 指定 exThumbImage 让它直接读元素自己的 data-thumb（在上面设好了）。
      // 注意光设 data-thumb 没用：thumb 不在核心的 defaultDynamicOptions 白名单里。
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
    // 元素没变说明 onMounted 那条路已经在处理了，**绝不能**再 teardown 一次：
    // 那会把 current 清空，让紧接着的 init 绕过幂等判断，于是同一个容器上挂了
    // 两个 lightGallery 实例。两个实例打开时完全重合、看着正常，一点缩略图就
    // 只有其中一个跳片，另一个停在原处——表现就是新图和之前那张叠在一起。
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
