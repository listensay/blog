<script setup lang="ts">
const model = defineModel<string>({ default: '' })
</script>
<template>
  <textarea
    v-model="model"
    class="w-full min-w-0 resize-y rounded-md border border-panel-line bg-panel-raised px-3 py-2 text-base leading-relaxed text-panel-text placeholder:text-panel-muted/70 transition-colors hover:border-panel-muted/60 focus:border-interactive focus-visible:-outline-offset-2 disabled:opacity-50"
  />
</template>
