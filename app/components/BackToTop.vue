<script setup lang="ts">
const visible = ref(false)

function updateVisibility() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight
  const revealAt = Math.min(240, Math.max(80, maxScroll * 0.35))
  visible.value = maxScroll > 80 && window.scrollY >= revealAt
}

function backToTop() {
  window.scrollTo({
    top: 0,
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  })
}

onMounted(() => {
  updateVisibility()
  window.addEventListener('scroll', updateVisibility, { passive: true })
  window.addEventListener('resize', updateVisibility, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateVisibility)
  window.removeEventListener('resize', updateVisibility)
})
</script>

<template>
  <Transition name="back-to-top">
    <button
      v-if="visible"
      type="button"
      class="back-to-top-button"
      aria-label="回到顶部"
      title="回到顶部"
      @click="backToTop"
    >
      <span class="back-to-top-triangle" aria-hidden="true" />
    </button>
  </Transition>
</template>

<style scoped>
.back-to-top-button {
  position: fixed;
  right: max(1rem, env(safe-area-inset-right));
  bottom: max(1rem, env(safe-area-inset-bottom));
  z-index: 30;
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border: 0;
  background: transparent;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.back-to-top-triangle {
  width: 0;
  height: 0;
  border-right: 12px solid transparent;
  border-bottom: 20px solid #ff8f9d;
  border-left: 12px solid transparent;
  filter: drop-shadow(0 4px 5px rgb(244 100 118 / 0.24));
  transform-origin: 50% 70%;
}

@media (hover: hover) {
  .back-to-top-button:hover .back-to-top-triangle {
    animation: triangle-jelly 520ms ease-out;
    border-bottom-color: #ff7889;
  }
}

.back-to-top-button:active .back-to-top-triangle {
  transform: scale(0.88, 1.12);
}

.back-to-top-enter-active,
.back-to-top-leave-active {
  transition:
    opacity var(--anim-base) var(--anim-ease),
    transform var(--anim-base) var(--anim-ease);
}

.back-to-top-enter-from,
.back-to-top-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.85);
}

@keyframes triangle-jelly {
  0%,
  100% {
    transform: scale(1);
  }
  28% {
    transform: scale(1.2, 0.78) translateY(2px);
  }
  52% {
    transform: scale(0.84, 1.18) translateY(-3px);
  }
  72% {
    transform: scale(1.08, 0.94) translateY(1px);
  }
  88% {
    transform: scale(0.97, 1.04);
  }
}
</style>
