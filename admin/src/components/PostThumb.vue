<script setup lang="ts">
// 列表页的封面缩略图。cover 先过 toPreviewSrc；解析不到或文件不在都是线上 404，而构建期只有一行 warn
// 用原生 <img> 不用 a-image：后者转发 class 却不带 scoped 的 data-v，样式会静默失效
import { computed, ref, watch } from 'vue'
import { FileImageOutlined, WarningOutlined } from '@ant-design/icons-vue'

import { PUBLIC_MOUNT, postContentDir, toPreviewSrc } from '@/utils/markdown'

const props = defineProps<{
  /** frontmatter 里的 cover 原文 */
  cover: string
  /** 文章所在子目录，相对路径要靠它算层数 */
  dir: string
}>()

/** 地址算对了，但文件不在 */
const broken = ref(false)

const src = computed(() =>
  props.cover ? toPreviewSrc(props.cover, postContentDir(props.dir)) : '',
)

/** 解析不到 public/ 时 toPreviewSrc 原样返回，所以换算成功的标志是变成了 `/blog-public/…` */
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
