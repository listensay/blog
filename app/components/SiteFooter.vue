<script setup lang="ts">
const year = new Date().getFullYear()
</script>

<template>
  <footer class="mt-20 border-t border-slate-200 bg-slate-50">
    <div
      class="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6"
    >
      <p>© {{ year }} {{ siteConfig.author }}</p>
    </div>
  </footer>
</template>
