<script setup lang="ts">
import { taxonomyLink } from '../utils/taxonomy'

withDefaults(defineProps<{ tag: string, variant?: 'default' | 'list' | 'cover' }>(), { variant: 'default' })
</script>

<template>
  <NuxtLink
    :to="taxonomyLink('tags', tag)"
    class="tag-chip inline-flex items-center text-xs font-medium transition-colors"
    :class="variant === 'list'
      ? 'rounded-xs bg-[#ffffff08] px-[5px] py-0 leading-[1.8] text-[#aaa2c2] hover:bg-[#f4d47b15] hover:text-accent'
      : variant === 'cover'
        ? 'rounded-sm border border-white/25 bg-panel/80 px-2.5 py-0.5 text-panel-text hover:border-accent/50 hover:bg-panel hover:text-accent'
        : ['rounded-sm px-2.5 py-0.5', tagTone(tag)]"
  >
    {{ taxonomyLabel(tag, 'tag') }}
  </NuxtLink>
</template>
