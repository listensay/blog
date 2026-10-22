<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 18 })
const paths: Record<string, string[]> = {
  refresh: ['M20 7v5h-5', 'M4 17v-5h5', 'M6 7a7 7 0 0 1 12-2l2 2', 'M18 17a7 7 0 0 1-12 2l-2-2'],
  save: [
    'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z',
    'M17 21v-8H7v8',
    'M7 3v5h8',
  ],
  trash: ['M3 6h18', 'M9 6V4h6v2', 'M5 6l1 14h12l1-14', 'M10 10v6', 'M14 10v6'],
  up: ['M6 15l6-6 6 6'],
  down: ['M6 9l6 6 6-6'],
  plus: ['M12 5v14', 'M5 12h14'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  external: [
    'M14 3h7v7',
    'M21 3l-9 9',
    'M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5',
  ],
  upload: ['M12 16V3', 'M7 8l5-5 5 5', 'M4 16v4h16v-4'],
  image: ['M3 3h18v18H3Z', 'M3 16l5-5 5 5', 'M12 15l4-4 5 5', 'M15 7h.01'],
  dashboard: ['M3 3h7v7H3Z', 'M14 3h7v7h-7Z', 'M3 14h7v7H3Z', 'M14 14h7v7h-7Z'],
  article: ['M5 3h14v18H5Z', 'M9 7h6', 'M9 11h6', 'M9 15h6'],
  link: ['M9 15l6-6', 'M11 6l1-1a5 5 0 0 1 7 7l-1 1', 'M13 18l-1 1a5 5 0 0 1-7-7l1-1'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  social: [
    'M7 12l10-6',
    'M7 12l10 6',
    'M3 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
    'M17 5a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
    'M17 19a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  ],
  settings: ['M4 7h16', 'M4 17h16', 'M8 4v6', 'M16 14v6'],
  check: ['M5 12l4 4L19 6'],
  warning: ['M12 3L2 21h20Z', 'M12 9v5', 'M12 17h.01'],
}
</script>
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="shrink-0"
    aria-hidden="true"
  >
    <path v-for="(d, index) in paths[name] ?? paths.article" :key="index" :d="d" />
  </svg>
</template>
