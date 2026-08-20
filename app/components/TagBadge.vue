<script setup lang="ts">
import { taxonomyLink } from '../utils/taxonomy'

defineProps<{ tag: string }>()
</script>

<template>
  <!-- 颜色跟着标签名走，同一个标签在全站是同一色（见 utils/tag-color.ts） -->
  <NuxtLink
    :to="taxonomyLink('tags', tag)"
    class="tag-chip"
    :class="tagTone(tag)"
  >
    {{ tag }}
  </NuxtLink>
</template>
