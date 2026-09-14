<script setup lang="ts">
import { taxonomyLink } from '../utils/taxonomy'

const { localPath, taxonomyLabel } = useLocale()

defineProps<{
  category: string
  light?: boolean
}>()
</script>

<template>
  <NuxtLink
    :to="localPath(taxonomyLink('categories', category))"
    class="font-medium underline-offset-4 transition-colors"
    :class="light ? 'text-white hover:text-white/80' : 'text-slate-600 hover:text-brand-600'"
  >
    {{ taxonomyLabel(category, 'category') }}
  </NuxtLink>
</template>
