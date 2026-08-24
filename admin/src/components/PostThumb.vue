<script setup lang="ts">
/**
 * 列表页的封面缩略图。
 *
 * 图取自 frontmatter 的 `cover`，写法和正文图片一样是**相对路径**，所以要先过一遍
 * `toPreviewSrc` 换算成 admin 自己挂的预览地址（见 utils/markdown.ts）。
 *
 * 三种状态刻意区分开，因为它们的含义完全不同：
 *
 *  - **没写 cover**：灰色占位。仓库里不少老文章就是这样，不是错误，不用报警。
 *  - **路径解析不到 public/**：`toPreviewSrc` 会原样返回，红色占位 + 说明。这种图
 *    **线上一定 404** —— blog 构建时只打一行 `[image-src]` warn，很容易漏，
 *    所以在列表里就显眼地说出来。
 *  - **地址对但文件不在**：走 img 的 error 事件，同样是线上 404。
 *
 * 刻意用原生 `<img>` 而不是 `a-image`：后者把 `class` 转发到内部的 img 上、
 * 却不带 scoped 样式的 data-v 属性，样式会静默失效。缩略图想看大图就点开新标签页，
 * 本机工具够用了。
 */
import { computed, ref, watch } from 'vue'
import { FileImageOutlined, WarningOutlined } from '@ant-design/icons-vue'

import { PUBLIC_MOUNT, toPreviewSrc } from '@/utils/markdown'

const props = defineProps<{
  /** frontmatter 里的 cover 原文 */
  cover: string
  /** 文章所在子目录，相对路径要靠它算层数 */
  dir: string
}>()

/** 地址算对了，但文件不在 */
const broken = ref(false)

const src = computed(() => (props.cover ? toPreviewSrc(props.cover, props.dir) : ''))

/**
 * `toPreviewSrc` 解析不到 `public/` 里就原样返回原始相对路径，
 * 所以「换算成功」的标志就是它变成了 `/blog-public/...`。
 */
const unresolved = computed(() => !!src.value && !src.value.startsWith(`${PUBLIC_MOUNT}/`))

// 表格翻页时组件会被复用，换了文章要把失败状态清掉，否则一直显示上一张的错误
watch(src, () => {
  broken.value = false
})

const problem = computed(() => {
  if (unresolved.value) return `这个路径解析不到 public/ 里，线上会 404：${props.cover}`
  if (broken.value) return `public/ 里找不到这个文件，线上会 404：${props.cover}`
  return ''
})
</script>

<template>
  <a-tooltip v-if="!cover" title="没有封面">
    <div class="thumb placeholder"><FileImageOutlined /></div>
  </a-tooltip>

  <a-tooltip v-else-if="problem" :title="problem">
    <div class="thumb placeholder bad"><WarningOutlined /></div>
  </a-tooltip>

  <a-tooltip v-else :title="`${cover}（点击看大图）`">
    <a :href="src" target="_blank" rel="noreferrer" @click.stop>
      <img class="thumb" :src="src" :alt="cover" loading="lazy" @error="broken = true" />
    </a>
  </a-tooltip>
</template>

<style scoped>
.thumb {
  display: block;
  width: 72px;
  height: 48px;
  border-radius: 4px;
  background: #fafafa;
  /* 缩略图只是用来认图的，裁掉溢出比整张缩瘪了更好认 */
  object-fit: cover;
}

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed #e8e8e8;
  color: #d9d9d9;
  font-size: 18px;
}

.bad {
  border-color: #ffccc7;
  color: #ff7875;
}
</style>
