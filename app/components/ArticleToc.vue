<script setup lang="ts">
import type { TocLink } from '@nuxt/content'
import { IconChevronDown } from '@tabler/icons-vue'

const props = defineProps<{ links: TocLink[], content?: HTMLElement }>()
const { t } = useLocale()
const listId = useId()
const expanded = ref(false)
const activeId = ref('')
const list = ref<HTMLElement>()

function flatten(links: TocLink[]): TocLink[] {
  return links.flatMap(link => [link, ...flatten(link.children ?? [])])
}

const entries = computed(() => flatten(props.links))
let headings: HTMLElement[] = []
let frame = 0

function updateActiveHeading() {
  frame = 0
  const headerOffset = (document.querySelector('header.sticky')?.getBoundingClientRect().bottom ?? 80) + 24
  const anchorOffset = headings[0] ? Number.parseFloat(getComputedStyle(headings[0]).scrollMarginTop) || 0 : 0
  const offset = Math.max(headerOffset, anchorOffset) + 1
  const visible = headings.filter(heading => heading.getClientRects().length)
  let current = visible[0]
  for (const heading of visible) {
    if (heading.getBoundingClientRect().top > offset) break
    current = heading
  }
  activeId.value = current?.id ?? ''
}

function scheduleUpdate() {
  if (!frame) frame = requestAnimationFrame(updateActiveHeading)
}

function revealHeading(id: string) {
  const heading = headings.find(item => item.id === id)
  if (!heading) return
  let revealed = false
  for (let parent = heading.parentElement; parent && parent !== props.content; parent = parent.parentElement) {
    if (parent instanceof HTMLDetailsElement && !parent.open) {
      parent.open = true
      revealed = true
    }
  }
  return { heading, revealed }
}

function onNavigate(event: MouseEvent, id: string) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  revealHeading(id)
  activeId.value = id
  // Keep the native anchor navigation, including browser history and keyboard focus.
}

function onHashChange() {
  let id: string
  try { id = decodeURIComponent(window.location.hash.slice(1)) }
  catch { return }
  const target = revealHeading(id)
  if (target?.revealed) target.heading.scrollIntoView()
  scheduleUpdate()
}

watch(activeId, async () => {
  await nextTick()
  const container = list.value
  const active = container?.querySelector<HTMLElement>('[aria-current="location"]')
  if (!container || !active || !container.getClientRects().length) return
  const bounds = container.getBoundingClientRect()
  const item = active.getBoundingClientRect()
  if (item.top < bounds.top) container.scrollTop += item.top - bounds.top
  else if (item.bottom > bounds.bottom) container.scrollTop += item.bottom - bounds.bottom
})

onMounted(() => {
  const resizeObserver = new ResizeObserver(scheduleUpdate)
  const mutationObserver = new MutationObserver(collectHeadings)

  function collectHeadings() {
    const ids = new Set(entries.value.map(entry => entry.id))
    headings = [...(props.content?.querySelectorAll<HTMLElement>('h2[id], h3[id]') ?? [])]
      .filter(heading => ids.has(heading.id))
    onHashChange()
  }

  const stop = watch(() => [props.content, props.links] as const, ([content], previous) => {
    previous?.[0]?.removeEventListener('toggle', scheduleUpdate, true)
    resizeObserver.disconnect()
    mutationObserver.disconnect()
    if (content) {
      resizeObserver.observe(content)
      mutationObserver.observe(content, { childList: true, subtree: true })
      content.addEventListener('toggle', scheduleUpdate, true)
    }
    collectHeadings()
  }, { immediate: true, flush: 'post' })

  window.addEventListener('scroll', scheduleUpdate, { passive: true })
  window.addEventListener('resize', scheduleUpdate, { passive: true })
  window.addEventListener('hashchange', onHashChange)

  onBeforeUnmount(() => {
    stop()
    resizeObserver.disconnect()
    mutationObserver.disconnect()
    props.content?.removeEventListener('toggle', scheduleUpdate, true)
    window.removeEventListener('scroll', scheduleUpdate)
    window.removeEventListener('resize', scheduleUpdate)
    window.removeEventListener('hashchange', onHashChange)
    cancelAnimationFrame(frame)
  })
})
</script>

<template>
  <aside class="mb-6 lg:sticky lg:top-24 lg:mb-0 lg:py-1" :aria-label="t('articleContents')">
    <button
      type="button"
      class="flex min-h-11 w-full items-center justify-between text-sm font-medium text-slate-500 lg:hidden"
      :aria-expanded="expanded"
      :aria-controls="listId"
      @click="expanded = !expanded"
    >
      {{ t('articleContents') }}
      <IconChevronDown :size="14" aria-hidden="true" class="transition-transform" :class="{ 'rotate-180': expanded }" />
    </button>
    <h2 class="hidden text-xs font-medium text-slate-500 lg:block">
      {{ t('articleContents') }}
    </h2>
    <nav
      :id="listId"
      ref="list"
      :aria-label="t('articleContents')"
      class="mt-2 max-h-72 overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] lg:mt-4 lg:max-h-[calc(100dvh-10rem)]"
      :class="expanded ? 'block' : 'hidden lg:block'"
    >
      <ul class="border-l border-slate-200/80">
        <li v-for="(entry, index) in entries" :key="entry.id" :class="{ 'mt-4': entry.depth <= 2 && index > 0 }">
          <a
            :href="`#${encodeURIComponent(entry.id)}`"
            :title="entry.text"
            :aria-current="activeId === entry.id ? 'location' : undefined"
            class="-ml-px block truncate border-l py-1.5 pr-2 leading-5 transition-colors"
            :class="[
              entry.depth > 2 ? 'pl-6 text-[13px]' : 'pl-3 text-sm',
              activeId === entry.id
                ? 'border-black font-bold text-black'
                : 'border-transparent font-normal text-slate-500 hover:text-slate-600',
            ]"
            @click="onNavigate($event, entry.id)"
          >{{ entry.text }}</a>
        </li>
      </ul>
    </nav>
  </aside>
</template>
