<script setup lang="ts">
// 仿 Mantine ActionIcon 的 Vue 实现：light 变体 + 圆形（radius="xl"）。
// Mantine 本身是 React 库，Vue 项目里用这个组件替代，用法一致：
// <AppActionIcon label="邮箱" href="mailto:..." color="email"><Icon /></AppActionIcon>
//
// color 对应 Mantine ActionIcon 的 color 属性：内置各社交平台品牌色，
// 控制图标颜色与 hover 时的底色/描边。图标用 currentColor 自动继承。
const colors: Record<string, { rest: string; hover: string }> = {
  slate: {
    rest: 'text-slate-500',
    hover: 'hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700',
  },
  qq: {
    rest: 'text-[#12B7F5]',
    hover: 'hover:border-[#12B7F5]/40 hover:bg-[#12B7F5]/10 hover:text-[#12B7F5]',
  },
  email: {
    rest: 'text-[#ea4335]',
    hover: 'hover:border-[#ea4335]/40 hover:bg-[#ea4335]/10 hover:text-[#ea4335]',
  },
  github: {
    rest: 'text-[#24292f]',
    hover: 'hover:border-[#24292f]/40 hover:bg-[#24292f]/10 hover:text-[#24292f]',
  },
  rss: {
    rest: 'text-[#ee802f]',
    hover: 'hover:border-[#ee802f]/40 hover:bg-[#ee802f]/10 hover:text-[#ee802f]',
  },
}

const props = withDefaults(defineProps<{
  /** 无障碍标签（必填，对应 Mantine ActionIcon 的 aria-label） */
  label: string
  /** 传入后渲染为 <a>，可指向站外链接或 mailto */
  href?: string
  size?: 'sm' | 'md' | 'lg'
  /** 图标颜色：内置品牌色或 slate，见上方 colors 表 */
  color?: string
}>(), {
  size: 'lg',
  color: 'slate',
})

const colorClass = computed(() => {
  const c = colors[props.color] ?? colors.slate
  return [c.rest, c.hover].join(' ')
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
    class="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white transition-colors"
    :class="[sizeClass, colorClass]"
  >
    <slot />
  </component>
</template>
