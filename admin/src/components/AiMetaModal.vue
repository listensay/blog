<script setup lang="ts">
/**
 * 「生成标题 / slug / 摘要 / 标签」的结果确认。
 *
 * 和正文改写分开一个组件，因为要给人看的东西完全不同：正文改写要看差异，
 * 这里要看的是「新旧两个值放在一起，哪个更好」，而且**四个字段各自独立决定** ——
 * 摘要写得好但标题不合意太常见了，所以一个字段一个勾。
 *
 * ## 默认勾哪些
 *
 * 规则是「**空着的默认填，已经有值的默认不动**」，因为改一个已有的值是破坏性的：
 *
 *  - **slug 最要紧**：它直接进 URL。文章已经发出去过的话，改 slug 等于换网址，
 *    老链接全部 404，搜索引擎也要重新收录。所以已有 slug 时默认不勾，而且写明后果。
 *  - **标题**是作者的表达，AI 只是提个建议，已经写了就默认不动。
 *  - 描述和标签是派生信息，风险低，默认勾上 —— 点这个动作的人多半就是为了它俩。
 *
 * 标签是**合并**而不是覆盖：现有标签留着，AI 给的新词按需勾选。
 */
import { computed, ref, watch } from 'vue'

import type { AiMetaResult } from '@/types'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  loading: boolean
  error: string
  result: AiMetaResult | null
  /** 表单里现在的值，用来对照 */
  currentTitle: string
  currentSlug: string
  currentDescription: string
  currentTags: string[]
  /**
   * 拿一个 slug 去问「同目录下有没有别的文章已经用了」，撞了就返回那篇的文件名。
   * 为什么要在这儿查：撞车本来只有保存时才会被服务端拦下来（409），
   * 那时候 slug 已经填进表单、人也以为搞定了。
   */
  slugClash: (slug: string) => string
}>()

const emit = defineEmits<{
  apply: [{ title?: string; slug?: string; description?: string; tags?: string[] }]
  retry: []
}>()

/** 三个文本字段都可以直接改，改完再填进表单 */
const draft = ref({ title: '', slug: '', description: '' })
const use = ref({ title: false, slug: false, description: false })
/** 勾上的新标签 */
const picked = ref<string[]>([])

watch(
  () => props.result,
  (result) => {
    draft.value = {
      title: result?.title ?? '',
      slug: result?.slug ?? '',
      description: result?.description ?? '',
    }

    // 「空着的默认填，已经有值的默认不动」—— 见文件头的说明
    use.value = {
      title: !!result?.title && !props.currentTitle.trim(),
      slug: !!result?.slug && !props.currentSlug.trim(),
      description: !!result?.description,
    }

    // 标签默认只勾「现在还没有的」，已有的不用再加一遍
    picked.value = (result?.tags ?? []).filter((tag) => !props.currentTags.includes(tag))
  },
)

/** AI 给的标签里表单已经有的那些 —— 标出来，不用再选 */
const alreadyHave = computed(() =>
  (props.result?.tags ?? []).filter((tag) => props.currentTags.includes(tag)),
)

const newTags = computed(() =>
  (props.result?.tags ?? []).filter((tag) => !props.currentTags.includes(tag)),
)

/** 手动改过 slug 之后也要校验，不能只信服务端归一化过的那一版 */
const slugError = computed(() => {
  const slug = draft.value.slug.trim()
  if (!slug) return ''
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return '只能用小写字母、数字和连字符'
  const clash = props.slugClash(slug)
  return clash ? `和 ${clash} 撞了，两篇文章的 URL 会一样` : ''
})

/** 换 slug 就是换 URL，已经有 slug 时要说清楚 */
const slugIsReplacing = computed(
  () => !!props.currentSlug.trim() && draft.value.slug.trim() !== props.currentSlug.trim(),
)

const titleUnchanged = computed(
  () => !!props.result?.title && props.result.title.trim() === props.currentTitle.trim(),
)

const nothingPicked = computed(
  () => !use.value.title && !use.value.slug && !use.value.description && !picked.value.length,
)

/** 勾了 slug 但 slug 本身有问题 —— 不让填，否则保存时才报错 */
const blocked = computed(() => use.value.slug && !!slugError.value)

function apply() {
  const payload: { title?: string; slug?: string; description?: string; tags?: string[] } = {}

  if (use.value.title && draft.value.title.trim()) payload.title = draft.value.title.trim()
  if (use.value.slug && draft.value.slug.trim()) payload.slug = draft.value.slug.trim()
  if (use.value.description && draft.value.description.trim()) {
    payload.description = draft.value.description.trim()
  }
  // 合并：现有的排前面，保持原来的顺序
  if (picked.value.length) payload.tags = [...props.currentTags, ...picked.value]

  emit('apply', payload)
}
</script>

<template>
  <a-modal
    v-model:open="open"
    title="生成标题 / slug / 摘要 / 标签"
    width="680px"
    :mask-closable="false"
  >
    <a-spin :spinning="loading" tip="AI 正在读全文…">
      <a-alert v-if="error" type="error" show-icon :message="error" />

      <div v-else-if="result" class="body">
        <p class="lead">
          勾上的才会填进表单。<span class="muted">空着的字段默认帮你填，已经有值的默认不动。</span>
        </p>

        <!-- ------------------------------------------------------------ 标题 -->
        <section :class="{ off: !use.title }">
          <div class="head">
            <a-checkbox v-model:checked="use.title" :disabled="!result.title">填入标题</a-checkbox>
            <span v-if="titleUnchanged" class="count">AI 认为现在的标题已经够好，原样返回了</span>
          </div>
          <a-input
            v-model:value="draft.title"
            placeholder="AI 没给出标题"
            @input="use.title = true"
          />
          <div v-if="currentTitle" class="old">
            <span class="old-label">现在是</span>{{ currentTitle }}
          </div>
          <div v-else class="old muted">标题现在是空的</div>
          <div class="hint">改标题不影响网址 —— URL 由下面的 slug 决定</div>
        </section>

        <!-- -------------------------------------------------------------- slug -->
        <section :class="{ off: !use.slug }">
          <div class="head">
            <a-checkbox v-model:checked="use.slug" :disabled="!result.slug">填入 slug</a-checkbox>
            <span class="count">文章网址就是它</span>
          </div>
          <a-input
            v-model:value="draft.slug"
            class="mono-input"
            :status="slugError ? 'error' : ''"
            placeholder="AI 没给出可用的 slug，自己写一个"
            @input="use.slug = true"
          />
          <div v-if="slugError" class="bad">{{ slugError }}</div>
          <div v-if="currentSlug" class="old">
            <span class="old-label">现在是</span><span class="mono">{{ currentSlug }}</span>
          </div>
          <div v-else class="old muted">slug 现在是空的（必填，不然保存不了）</div>
          <a-alert
            v-if="use.slug && slugIsReplacing"
            type="warning"
            show-icon
            class="url-warn"
            message="这会换掉文章的网址"
            description="如果这篇已经发出去过，老链接会 404，搜索引擎收录也得重来。没发过就没关系。"
          />
        </section>

        <!-- ------------------------------------------------------------ 描述 -->
        <section :class="{ off: !use.description }">
          <div class="head">
            <a-checkbox v-model:checked="use.description" :disabled="!result.description">
              填入描述
            </a-checkbox>
            <span class="count">{{ draft.description.length }} 字</span>
          </div>
          <a-textarea
            v-model:value="draft.description"
            :auto-size="{ minRows: 2, maxRows: 5 }"
            @input="use.description = true"
          />
          <div v-if="currentDescription" class="old">
            <span class="old-label">现在是</span>{{ currentDescription }}
          </div>
          <div v-else class="old muted">描述现在是空的</div>
        </section>

        <!-- ------------------------------------------------------------ 标签 -->
        <section>
          <div class="head">
            <span class="label">标签</span>
            <span class="count">勾上的会加到现有标签后面，不会覆盖</span>
          </div>

          <a-checkbox-group v-if="newTags.length" v-model:value="picked">
            <a-checkbox v-for="tag in newTags" :key="tag" :value="tag">{{ tag }}</a-checkbox>
          </a-checkbox-group>
          <div v-else class="old muted">AI 给的标签这篇文章都已经有了</div>

          <div v-if="alreadyHave.length" class="old">
            <span class="old-label">已经有了</span>
            <a-tag v-for="tag in alreadyHave" :key="tag">{{ tag }}</a-tag>
          </div>
        </section>

        <div class="meta">
          <span class="mono">{{ result.model }}</span>
          <template v-if="result.usage">
            <a-divider type="vertical" />
            <span>{{ result.usage.prompt }} + {{ result.usage.completion }} tokens</span>
          </template>
        </div>
      </div>
    </a-spin>

    <template #footer>
      <a-button @click="open = false">取消</a-button>
      <a-button :disabled="loading" @click="emit('retry')">重新生成</a-button>
      <a-tooltip :title="blocked ? `slug ${slugError}` : ''">
        <a-button
          type="primary"
          :disabled="loading || !result || nothingPicked || blocked"
          @click="apply"
        >
          填进表单
        </a-button>
      </a-tooltip>
    </template>
  </a-modal>
</template>

<style scoped>
.body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-height: 62vh;
  overflow-y: auto;
}

.lead {
  margin: 0;
  font-size: 12px;
  color: #595959;
}

/*
 * 没勾的那一块整体压暗，但**输入框里的字仍然是可读的**（刻意不用 disabled）——
 * 你要先看清 AI 给的建议才能决定勾不勾，灰掉就本末倒置了。
 * 而且这些框一直能编辑：动手改了就说明你要用它，@input 会自动把勾打上。
 */
.off {
  opacity: 0.72;
}

.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.label {
  font-weight: 500;
}

.count {
  flex: none;
  color: #bfbfbf;
  font-size: 12px;
}

.old {
  margin-top: 8px;
  color: #8c8c8c;
  font-size: 12px;
  line-height: 1.7;
}

.old-label {
  margin-right: 6px;
  color: #bfbfbf;
}

.hint {
  margin-top: 4px;
  color: #bfbfbf;
  font-size: 12px;
}

.bad {
  margin-top: 4px;
  color: #ff4d4f;
  font-size: 12px;
}

.muted {
  color: #bfbfbf;
}

.mono-input {
  font-family: var(--mono);
}

.url-warn {
  margin-top: 8px;
}

.meta {
  color: #bfbfbf;
  font-size: 12px;
}
</style>
