<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const detail = computed(() => {
  const code = props.error.statusCode ?? 500
  if (code >= 500) return '服务端出现了一个意外错误。'
  return props.error.message || props.error.statusMessage || '请求无法完成。'
})

useSeo({
  title: () => (props.error.statusCode === 404 ? '页面不存在' : '出错了'),
  description: () => detail.value,
  noindex: true,
})
</script>

<template>
  <NuxtLayout>
    <div class="flex min-h-[60vh] flex-col items-center justify-center px-2 py-16 text-center sm:py-20">
      <p class="text-5xl font-bold tracking-tight text-brand-600 sm:text-6xl">
        {{ error.statusCode }}
      </p>
      <h1 class="mt-4 text-2xl font-semibold text-slate-900">
        {{ error.statusCode === 404 ? '页面不存在' : '出错了' }}
      </h1>
      <p class="mt-2 max-w-md text-slate-600">
        {{ error.statusCode === 404
          ? '你访问的地址没有对应的内容，可能是链接写错了。'
          : detail }}
      </p>
      <button
        type="button"
        class="mt-8 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
        @click="clearError({ redirect: '/' })"
      >
        返回首页
      </button>
    </div>
  </NuxtLayout>
</template>
