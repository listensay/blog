<script setup lang="ts">
import type { NuxtError } from '#app'

const { t, localPath } = useLocale()

const props = defineProps<{ error: NuxtError }>()

const detail = computed(() => {
  const code = props.error.statusCode ?? 500
  if (code >= 500) return t('anUnexpectedServerErrorOccurred')
  return props.error.message || props.error.statusMessage || t('theRequestCouldNotBeCompleted')
})

useSeo({
  title: () => (props.error.statusCode === 404 ? t('pageNotFound') : t('somethingWentWrong')),
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
        {{ error.statusCode === 404 ? t('pageNotFound') : t('somethingWentWrong') }}
      </h1>
      <p class="mt-2 max-w-md text-slate-600">
        {{ error.statusCode === 404
          ? t('thereIsNoContentAtThisAddressPleaseCheckTheLink')
          : detail }}
      </p>
      <button
        type="button"
        class="mt-8 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
        @click="clearError({ redirect: localPath('/') })"
      >
        {{ t('backToHome') }}
      </button>
    </div>
  </NuxtLayout>
</template>
