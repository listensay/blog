<template>
  <div class="skeleton-group rounded-none bg-transparent">
    <header class="border-b border-panel-line pb-6 sm:pb-8" role="status" aria-busy="true">
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

    <div class="mt-8 sm:mt-10">
      <ProseSkeleton :paragraphs="2" />
    </div>
    <div class="mt-8 rounded-sm bg-panel-raised p-5 sm:p-7">
      <div class="skeleton mb-5 h-7 w-2/5" />
      <ProseSkeleton :paragraphs="3" />
    </div>
  </div>
</template>
