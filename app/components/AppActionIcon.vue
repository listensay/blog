<script setup lang="ts">
// 仿 Mantine ActionIcon 的 Vue 实现：light 变体 + 圆形，用法 <AppActionIcon label href color>。
// color 是任意 hex 主题色，图标常驻此色，hover 时底色/描边用 color-mix 生成同色淡变体
const props = withDefaults(defineProps<{
  /** 无障碍标签（必填，对应 Mantine ActionIcon 的 aria-label） */
  label: string
  /** 传入后渲染为 <a>，可指向站外链接或 mailto */
  href?: string
  size?: 'sm' | 'md' | 'lg'
  /** 图标主题色，任意 hex（#rrggbb） */
  color?: string
}>(), {
  size: 'lg',
  color: '#64748b', // slate-500
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
    class="action-icon inline-flex items-center justify-center rounded-full border border-slate-200 bg-white transition-colors"
    :class="sizeClass"
    :style="{ '--icon-color': color, color }"
  >
    <slot />
  </component>
</template>

<style scoped>
/* hover 时底色、描边、图标一起过渡到主题色（10% / 40% 淡变体） */
.action-icon:hover {
  color: var(--icon-color);
  background-color: color-mix(in srgb, var(--icon-color) 10%, white);
  border-color: color-mix(in srgb, var(--icon-color) 40%, white);
}
</style>
