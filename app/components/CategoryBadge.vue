<script setup lang="ts">
defineProps<{ category: string }>()
</script>

<!-- 分类刻意做成纯文字链接：它和标签是两种不同的东西，长得一样反而看不出区别。
     色块留给标签，分类靠字重比旁边的日期重一点来区分。 -->
<template>
  <NuxtLink
    :to="`/categories/${encodeURIComponent(category)}`"
    class="font-medium text-slate-600 underline-offset-4 transition-colors hover:text-brand-600"
  >
    {{ category }}
  </NuxtLink>
</template>
