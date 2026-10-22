<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import UiButton from './UiButton.vue'
import UiInput from './UiInput.vue'
const props = defineProps<{ options: { value: string; label: string }[]; label: string }>()
const model = defineModel<string[]>({ required: true })
const text = ref('')
const listId = useId()
const available = computed(() =>
  props.options.filter((option) => !model.value.includes(option.value)),
)
const labelOf = (value: string) =>
  props.options.find((option) => option.value === value)?.label ?? value
function add() {
  const value = text.value.trim()
  if (value && !model.value.includes(value)) model.value = [...model.value, value]
  text.value = ''
}
</script>
<template>
  <div class="space-y-3">
    <div v-if="model.length" class="flex flex-wrap gap-2">
      <span
        v-for="value in model"
        :key="value"
        class="inline-flex items-center gap-1 rounded-sm border border-interactive/20 bg-interactive/10 pl-3 text-sm text-interactive"
        >{{ labelOf(value)
        }}<UiButton
          variant="ghost"
          icon="close"
          :aria-label="`移除${labelOf(value)}`"
          @click="model = model.filter((item) => item !== value)"
      /></span>
    </div>
    <div class="flex gap-2">
      <UiInput
        v-model="text"
        :list="listId"
        :aria-label="label"
        @keydown.enter.prevent="add"
      /><UiButton :disabled="!text.trim()" icon="plus" @click="add">添加分类</UiButton>
    </div>
    <datalist :id="listId">
      <option v-for="option in available" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </datalist>
  </div>
</template>
