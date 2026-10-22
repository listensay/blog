<script setup lang="ts">
import UiIcon from './UiIcon.vue'
withDefaults(defineProps<{ message: string; description?: string; tone?: 'error' | 'warning' }>(), {
  tone: 'error',
})
</script>
<template>
  <div
    :role="tone === 'error' ? 'alert' : 'status'"
    class="flex gap-3 rounded-sm border p-4 text-sm leading-relaxed"
    :class="
      tone === 'error'
        ? 'border-danger/30 bg-danger/5 text-danger'
        : 'border-accent/60 bg-accent/15 text-warning-ink'
    "
  >
    <UiIcon name="warning" class="mt-0.5" />
    <div class="min-w-0 break-words">
      <p>{{ message }}</p>
      <p v-if="description" class="mt-1 text-panel-muted">{{ description }}</p>
      <slot />
    </div>
  </div>
</template>
