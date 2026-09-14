<script setup lang="ts">
import { taxonomyLink } from '../utils/taxonomy'

const { localPath, taxonomyLabel } = useLocale()

defineProps<{ tag: string }>()
</script>

<template>
  <NuxtLink
    :to="localPath(taxonomyLink('tags', tag))"
    class="tag-chip"
    :class="tagTone(tag)"
  >
    {{ taxonomyLabel(tag, 'tag') }}
  </NuxtLink>
</template>
