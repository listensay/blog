<template>
  <div
    class="flex min-h-40 items-center justify-center gap-3 text-sm text-panel-muted"
    role="status"
  >
    <span
      class="size-5 animate-spin rounded-full border-2 border-interactive/25 border-t-interactive motion-reduce:animate-none"
      aria-hidden="true"
    />
    <slot>正在加载</slot>
  </div>
</template>
