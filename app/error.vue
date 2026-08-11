<script setup lang="ts">
import type { NuxtError } from '#app'

defineProps<{ error: NuxtError }>()
</script>

<template>
  <NuxtLayout>
    <div class="flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p class="text-6xl font-bold tracking-tight text-brand-600">
        {{ error.statusCode }}
      </p>
      <h1 class="mt-4 text-2xl font-semibold text-slate-900">
        {{ error.statusCode === 404 ? '页面不存在' : '出错了' }}
      </h1>
      <p class="mt-2 max-w-md text-slate-600">
        {{ error.statusCode === 404
          ? '你访问的地址没有对应的内容，可能是链接写错了。'
          : (error.statusMessage || '服务端出现了一个意外错误。') }}
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
