<script setup lang="ts">
import UiIcon from './UiIcon.vue'
withDefaults(
  defineProps<{
    variant?: 'default' | 'primary' | 'danger' | 'ghost'
    loading?: boolean
    disabled?: boolean
    icon?: string
    type?: 'button' | 'submit' | 'reset'
  }>(),
  { variant: 'default', type: 'button' },
)
</script>
<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    class="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-sm border px-3 py-2 text-sm font-medium transition-colors duration-150 disabled:cursor-default disabled:opacity-45"
    :class="{
      'border-panel-line bg-panel text-panel-text hover:border-interactive/40 hover:bg-panel-raised':
        variant === 'default',
      'border-interactive bg-interactive text-white hover:border-interactive-hover hover:bg-interactive-hover':
        variant === 'primary',
      'border-danger/40 bg-danger/10 text-danger hover:border-danger hover:bg-danger/15':
        variant === 'danger',
      'border-transparent text-panel-muted hover:bg-panel-text/5 hover:text-interactive':
        variant === 'ghost',
    }"
  >
    <span
      v-if="loading"
      class="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
      aria-hidden="true"
    />
    <UiIcon v-else-if="icon" :name="icon" />
    <slot />
  </button>
</template>
