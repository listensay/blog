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
    class="inline-flex items-center justify-center rounded-full border border-panel-line bg-panel-raised text-(--icon-color) transition-colors hover:border-[color-mix(in_srgb,var(--icon-color)_40%,white)] hover:bg-[color-mix(in_srgb,var(--icon-color)_10%,white)]"
    :class="sizeClass"
    :style="{ '--icon-color': color }"
  >
    <slot />
  </component>
</template>
