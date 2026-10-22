<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { confirmation, dismissNotice, notices, settleConfirmation } from '@/composables/useFeedback'
import UiButton from './UiButton.vue'
import UiIcon from './UiIcon.vue'
import UiModal from './UiModal.vue'
const confirmOpen = computed({
  get: () => confirmation.value !== null,
  set: (value) => {
    if (!value) settleConfirmation(false)
  },
})
const toastHost = ref<HTMLDivElement>()
watch(
  () => notices.value.length,
  async (count) => {
    await nextTick()
    if (count) toastHost.value?.showPopover()
    else toastHost.value?.hidePopover()
  },
)
</script>
<template>
  <UiModal v-model:open="confirmOpen" :title="confirmation?.title ?? '确认操作'">
    <p v-if="confirmation?.content" class="text-base leading-relaxed text-panel-muted">
      {{ confirmation.content }}
    </p>
    <div class="mt-6 flex flex-wrap justify-end gap-2">
      <UiButton autofocus @click="settleConfirmation(false)">取消</UiButton>
      <UiButton
        :variant="confirmation?.danger ? 'danger' : 'primary'"
        @click="settleConfirmation(true)"
        >{{ confirmation?.confirmText ?? '确认' }}</UiButton
      >
    </div>
  </UiModal>
  <Teleport to="body">
    <div
      ref="toastHost"
      popover="manual"
      class="pointer-events-none fixed inset-auto top-4 right-4 m-0 w-[calc(100%-2rem)] max-w-sm overflow-visible border-0 bg-transparent p-0 text-panel-text"
    >
      <div
        v-for="notice in notices"
        :key="notice.id"
        :role="notice.tone === 'error' ? 'alert' : 'status'"
        class="pointer-events-auto mb-2 flex items-start gap-3 rounded-sm border bg-panel-raised p-3 shadow-lg"
        :class="notice.tone === 'error' ? 'border-danger/40' : 'border-success/40'"
      >
        <UiIcon
          :name="notice.tone === 'error' ? 'warning' : 'check'"
          class="mt-3"
          :class="notice.tone === 'error' ? 'text-danger' : 'text-success'"
        />
        <p class="min-w-0 flex-1 self-center break-words text-sm leading-relaxed">
          {{ notice.text }}
        </p>
        <UiButton
          icon="close"
          variant="ghost"
          aria-label="关闭提示"
          @click="dismissNotice(notice.id)"
        />
      </div>
    </div>
  </Teleport>
</template>
