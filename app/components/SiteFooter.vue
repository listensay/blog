<script setup lang="ts">
const year = new Date().getFullYear()
</script>

<template>
  <footer class="mt-12 border-t border-slate-200 bg-white sm:mt-20">
    <div
      class="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:px-6 sm:py-8"
    >
      <p>© {{ year }} {{ siteConfig.author }}</p>
      <a
        href="/sitemap.xml"
        class="transition-colors hover:text-slate-900"
      >
        网站地图
      </a>
    </div>
  </footer>
</template>
