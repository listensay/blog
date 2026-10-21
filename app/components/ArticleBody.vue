<script setup lang="ts">
import type { PageCollectionItemBase } from '@nuxt/content'
import { splitArticleSections } from '~/utils/article-sections'

const props = defineProps<{ value: PageCollectionItemBase }>()
const sections = computed(() => splitArticleSections(props.value.body))
</script>

<template>
  <div class="space-y-8">
    <section
      v-for="(section, index) in sections"
      :key="section.id ?? index"
      :aria-labelledby="section.id"
      class="prose-cn text-base leading-[1.9] sm:text-[17px] [&_p]:my-6 [&_h2]:scroll-mt-6 [&_h2]:border-0 [&_h2]:pb-0 [&_h2]:text-[22px] [&_h2]:leading-[1.5] [&_h3]:mt-8 [&_h3]:mb-4 [&_h3]:scroll-mt-6 [&_h3]:text-lg [&_h2>a]:text-panel-text [&_h3>a]:text-panel-text [&>div>:first-child]:mt-0 [&>div>:last-child]:mb-0"
      :class="section.number
        ? 'rounded-sm bg-panel-raised p-5 sm:p-7'
        : 'rounded-none bg-transparent p-0 md:p-0'"
    >
      <span v-if="section.number" class="mb-3 block text-xs text-accent tabular-nums" aria-hidden="true">
        {{ String(section.number).padStart(2, '0') }}
      </span>
      <ContentRenderer :value="{ ...value, body: section.body }" />
    </section>
  </div>
</template>
