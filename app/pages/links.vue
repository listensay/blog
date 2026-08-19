<script setup lang="ts">
// NuxtLink 得从 #components 显式引入。它是编译期自动导入的，并没有注册成全局组件，
// 模板里写 resolveComponent('NuxtLink') 解析不到，会原样吐出一个 <NuxtLink> 标签
// ——浏览器当成未知元素，内链就点不动了。
import { NuxtLink } from '#components'

// 外链要新窗口打开并加 noopener，内链走前端路由
const isExternal = (url: string) => /^https?:\/\//.test(url)

// 无头像时用名字首字符占位
const initial = (name: string) => [...name][0] ?? '?'

useSeo({
  title: '友情链接',
  description: `${siteConfig.title}交换的友情链接`,
})
</script>

<template>
  <div class="py-8 sm:py-16">
    <header class="border-b border-slate-200 pb-6 sm:pb-8">
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">友情链接</h1>
    </header>

    <ul v-if="friendLinks.length" class="mt-8 grid gap-4 sm:grid-cols-2">
      <li v-for="(link, i) in friendLinks" :key="link.url" v-reveal="i">
        <component
          :is="isExternal(link.url) ? 'a' : NuxtLink"
          v-bind="isExternal(link.url)
            ? { href: link.url, target: '_blank', rel: 'noopener noreferrer' }
            : { to: link.url }"
          class="group flex h-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
        >
          <img
            v-if="link.avatar"
            :src="link.avatar"
            :alt="`${link.name} 的头像`"
            width="48"
            height="48"
            loading="lazy"
            class="size-12 shrink-0 rounded-full object-cover"
          >
          <span
            v-else
            aria-hidden="true"
            class="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700"
          >
            {{ initial(link.name) }}
          </span>

          <span class="min-w-0">
            <span class="block truncate font-semibold text-slate-900 group-hover:text-brand-700">
              {{ link.name }}
            </span>
            <span class="mt-0.5 block truncate text-sm text-slate-500">
              {{ link.description }}
            </span>
          </span>
        </component>
      </li>
    </ul>
    <p v-else class="py-10 text-slate-500 sm:py-12">还没有友情链接。</p>
  </div>
</template>
