<script setup lang="ts">
const model = defineModel<string>({ default: '' })
</script>
<template>
  <input
    v-model="model"
    class="min-h-11 w-full min-w-0 rounded-md border border-panel-line bg-panel-raised px-3 py-2 text-base text-panel-text placeholder:text-panel-muted/70 transition-colors hover:border-panel-muted/60 focus:border-interactive focus-visible:-outline-offset-2 disabled:opacity-50"
  />
</template>
