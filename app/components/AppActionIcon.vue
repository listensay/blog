<script setup lang="ts">
const props = withDefaults(defineProps<{
  label: string
  href?: string
  size?: 'sm' | 'md' | 'lg'
  color?: string
}>(), {
  size: 'lg',
  color: '#64748b',
})

const sizeClass = computed(() => (
  props.size === 'lg' ? 'size-10' : props.size === 'md' ? 'size-9' : 'size-8'
))
</script>

<template>
  <component
    :is="href ? 'a' : 'button'"
    :href="href"
    :target="href?.startsWith('http') ? '_blank' : undefined"
    :rel="href?.startsWith('http') ? 'noopener noreferrer' : undefined"
    :aria-label="label"
    :title="label"
    :type="href ? undefined : 'button'"
    class="action-icon inline-flex items-center justify-center rounded-full border border-slate-200 bg-white transition-colors"
    :class="sizeClass"
    :style="{ '--icon-color': color, color }"
  >
    <slot />
  </component>
</template>

<style scoped>
.action-icon:hover {
  color: var(--icon-color);
  background-color: color-mix(in srgb, var(--icon-color) 10%, white);
  border-color: color-mix(in srgb, var(--icon-color) 40%, white);
}
</style>
