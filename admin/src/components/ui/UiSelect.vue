<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import UiIcon from './UiIcon.vue'
const props = defineProps<{ options: { value: string; label: string }[]; label: string }>()
const model = defineModel<string>({ required: true })
const opened = ref(false)
const search = ref('')
const active = ref(-1)
const input = ref<HTMLInputElement>()
const listId = useId()
const selectedLabel = computed(
  () => props.options.find((option) => option.value === model.value)?.label ?? model.value,
)
const filtered = computed(() =>
  props.options.filter((option) =>
    `${option.label} ${option.value}`.toLowerCase().includes(search.value.toLowerCase()),
  ),
)
watch(filtered, () => {
  active.value = filtered.value.length ? 0 : -1
})
async function start() {
  search.value = ''
  opened.value = true
  active.value = filtered.value.findIndex((option) => option.value === model.value)
  await nextTick()
  input.value?.focus()
}
function choose(value: string) {
  model.value = value
  opened.value = false
}
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    opened.value = false
    return
  }
  if (event.key === 'Tab') {
    opened.value = false
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    if (!opened.value) void start()
    else if (filtered.value[active.value]) choose(filtered.value[active.value]!.value)
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!opened.value) void start()
    else
      active.value = Math.max(
        0,
        Math.min(filtered.value.length - 1, active.value + (event.key === 'ArrowDown' ? 1 : -1)),
      )
    void nextTick(() =>
      document.getElementById(`${listId}-${active.value}`)?.scrollIntoView({ block: 'nearest' }),
    )
  }
}
function onInput(event: Event) {
  search.value = (event.target as HTMLInputElement).value
  opened.value = true
}
function blur(event: FocusEvent) {
  if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null))
    opened.value = false
}
</script>
<template>
  <div class="relative min-w-0" @focusout="blur">
    <div
      class="flex min-h-11 items-center rounded-md border border-panel-line bg-panel-raised focus-within:border-interactive has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-interactive"
    >
      <span v-if="$slots.icon" class="pl-3"><slot name="icon" /></span>
      <input
        ref="input"
        role="combobox"
        :aria-label="label"
        :aria-expanded="opened"
        :aria-controls="listId"
        aria-autocomplete="list"
        :aria-activedescendant="opened && active >= 0 ? `${listId}-${active}` : undefined"
        :value="opened ? search : selectedLabel"
        class="w-full min-w-0 border-0 bg-transparent px-3 py-2 text-base outline-none"
        @click="!opened && start()"
        @input="onInput"
        @keydown="keydown"
      />
      <button
        type="button"
        :aria-label="`选择${label}`"
        tabindex="-1"
        class="grid min-h-11 w-11 shrink-0 cursor-pointer place-items-center text-panel-muted outline-none"
        @click="opened ? (opened = false) : start()"
      >
        <UiIcon name="down" />
      </button>
    </div>
    <ul
      v-if="opened"
      :id="listId"
      role="listbox"
      :aria-label="label"
      class="absolute top-full z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-sm border border-panel-line bg-panel-raised p-1 shadow-lg"
    >
      <li
        v-for="(option, index) in filtered"
        :id="`${listId}-${index}`"
        :key="option.value"
        role="option"
        :aria-selected="model === option.value"
        class="flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-panel-text/5"
        :class="index === active ? 'bg-interactive/10 text-interactive' : 'text-panel-text'"
        @mousedown.prevent
        @click="choose(option.value)"
      >
        <slot name="option" :option="option">{{ option.label }}</slot
        ><UiIcon v-if="model === option.value" name="check" class="ml-auto text-interactive" />
      </li>
      <li v-if="!filtered.length" class="px-3 py-3 text-sm text-panel-muted">无匹配选项</li>
    </ul>
  </div>
</template>
