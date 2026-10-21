<script setup lang="ts">
const year = new Date().getFullYear()
</script>

<template>
  <footer class="site-footer mt-[38px] [border-top:1px_solid_var(--color-panel-line)] max-md:mt-[26px] lg:shrink-0">
    <div class="site-footer-inner flex items-center justify-between p-[18px_28px] text-[#9390a9] text-xs max-md:p-[16px]">
      <p>© {{ year }} {{ siteConfig.author }}</p>
      <a
        href="/sitemap.xml"
        class="footer-link hover:text-accent"
      >
        网站地图
      </a>
    </div>
  </footer>
</template>
