<script setup lang="ts">
import BackToTop from '~/components/BackToTop.vue'
</script>

<template>
  <div class="flex min-h-screen flex-col text-slate-800">
    <SiteHeader />
    <main class="flex-1">
      <div class="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <slot />
      </div>
    </main>
    <SiteFooter />
    <BackToTop />
  </div>
</template>
