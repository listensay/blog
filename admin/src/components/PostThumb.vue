<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { FileImageOutlined, WarningOutlined } from '@ant-design/icons-vue'

import { PUBLIC_MOUNT, postContentDir, toPreviewSrc } from '@/utils/markdown'

const props = defineProps<{
  cover: string
  dir: string
}>()

const broken = ref(false)

const src = computed(() =>
  props.cover ? toPreviewSrc(props.cover, postContentDir(props.dir)) : '',
)

const unresolved = computed(() => !!src.value && !src.value.startsWith(`${PUBLIC_MOUNT}/`))

watch(src, () => {
  broken.value = false
})

const problem = computed(() => {
  if (unresolved.value) return `路径无法解析到 public/：${props.cover}`
  if (broken.value) return `public/ 中不存在该文件：${props.cover}`
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
