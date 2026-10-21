<script setup lang="ts">
const props = defineProps<{ scrollContainer?: HTMLElement | null }>()
const visible = ref(false)

function activeContainer() {
  return props.scrollContainer && window.matchMedia('(min-width: 1024px)').matches
    ? props.scrollContainer
    : null
}

function updateVisibility() {
  const container = activeContainer()
  const maxScroll = container
    ? container.scrollHeight - container.clientHeight
    : document.documentElement.scrollHeight - window.innerHeight
  const revealAt = Math.min(240, Math.max(80, maxScroll * 0.35))
  visible.value = maxScroll > 80 && (container?.scrollTop ?? window.scrollY) >= revealAt
}

function backToTop() {
  const target = activeContainer() ?? window
  target.scrollTo({
    top: 0,
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  })
}

onMounted(() => {
  updateVisibility()
  document.addEventListener('scroll', updateVisibility, { capture: true, passive: true })
  window.addEventListener('resize', updateVisibility, { passive: true })
})

watch(() => props.scrollContainer, () => nextTick(updateVisibility), { flush: 'post' })

onBeforeUnmount(() => {
  document.removeEventListener('scroll', updateVisibility, true)
  window.removeEventListener('resize', updateVisibility)
})
</script>

<template>
  <Transition
    enter-active-class="transition-[opacity,transform] duration-200 ease-out"
    leave-active-class="transition-[opacity,transform] duration-200 ease-out"
    enter-from-class="translate-y-2.5 scale-85 opacity-0"
    leave-to-class="translate-y-2.5 scale-85 opacity-0"
  >
    <button
      v-if="visible"
      type="button"
      class="back-to-top-button group fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 grid size-11 cursor-pointer place-items-center border-0 bg-transparent [-webkit-tap-highlight-color:transparent]"
      aria-label="回到顶部"
      title="回到顶部"
      @click="backToTop"
    >
      <span class="back-to-top-triangle size-0 origin-[50%_70%] border-r-12 border-b-20 border-l-12 border-r-transparent border-b-accent border-l-transparent drop-shadow-sm group-active:scale-x-[.88] group-active:scale-y-[1.12] [@media(hover:hover)]:group-hover:animate-triangle-jelly" aria-hidden="true" />
    </button>
  </Transition>
</template>
