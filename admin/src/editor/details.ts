import { Node, mergeAttributes } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

/**
 * 折叠块。文件里的写法是：
 *
 *   <details>
 *   <summary><h3>标题</h3></summary>
 *
 *   正文
 *
 *   </details>
 *
 * 编辑器里始终展开，否则内容点不进去。回程的固定格式在 utils/markdown.ts 的 turndown 规则里。
 */
export const Details = Node.create({
  name: 'details',
  group: 'block',
  content: 'detailsSummary block+',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'details' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['details', mergeAttributes(HTMLAttributes, { open: 'open' }), 0]
  },
})

export const DetailsSummary = Node.create({
  name: 'detailsSummary',
  content: 'text*',
  marks: '',
  defining: true,
  isolating: true,

  parseHTML() {
    return [
      {
        tag: 'summary',
        // 标题一律按纯文本处理：<h3> 外壳去掉，其余标签只留文字，一个字都不丢
        contentElement: (element) => {
          const summary = element as HTMLElement
          const holder = summary.ownerDocument.createElement('span')
          holder.textContent = (summary.textContent ?? '').trim()
          return holder
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['summary', HTMLAttributes, 0]
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { state, view } = this.editor
        const { $from, empty } = state.selection
        if (!empty || $from.parent.type.name !== this.name) return false

        const target = TextSelection.near(state.doc.resolve($from.after($from.depth)))
        view.dispatch(state.tr.setSelection(target).scrollIntoView())
        return true
      },
    }
  },
})
