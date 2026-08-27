<script setup lang="ts">
import { computed } from 'vue'

import { SOCIAL_ICON_FALLBACK, SOCIAL_ICON_PATHS } from '@/utils/social-icons'

const props = withDefaults(defineProps<{ name: string; size?: number; stroke?: number }>(), {
  size: 16,
  stroke: 1.8,
})

const paths = computed(
  () => SOCIAL_ICON_PATHS[props.name] ?? SOCIAL_ICON_PATHS[SOCIAL_ICON_FALLBACK] ?? [],
)
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="stroke"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(d, index) in paths" :key="index" :d="d" />
  </svg>
</template>
