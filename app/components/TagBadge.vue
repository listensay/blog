<script setup lang="ts">
import { taxonomyLink } from '../utils/taxonomy'

defineProps<{ tag: string }>()
</script>

<template>
  <NuxtLink
    :to="taxonomyLink('tags', tag)"
    class="tag-chip"
    :class="tagTone(tag)"
  >
    {{ tag }}
  </NuxtLink>
</template>
