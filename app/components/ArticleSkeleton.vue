<template>
  <!-- 文章详情页的骨架屏：元信息行 → 大标题（两行）→ 分隔线 → 正文。
       排布跟 blog/[slug].vue 的 header 对齐，正文到位时标题不会位移 -->
  <div class="skeleton-group">
    <header class="border-b border-slate-200 pb-6 sm:pb-8" role="status" aria-busy="true">
      <span class="sr-only">正在加载文章…</span>
      <div aria-hidden="true">
        <div class="flex items-center gap-3">
          <div class="skeleton h-4 w-24" />
          <div class="skeleton h-4 w-16" />
        </div>
        <div class="skeleton mt-5 h-9 w-4/5" />
        <div class="skeleton mt-2.5 h-9 w-2/5" />
      </div>
    </header>

    <div class="mt-6 rounded-xl bg-white p-4 sm:mt-10 sm:p-6">
      <ProseSkeleton :paragraphs="4" />
    </div>
  </div>
</template>
