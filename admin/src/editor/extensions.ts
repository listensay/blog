// tiptap 的扩展配置。单独拎出来（不放 .vue 里）是为了能在 node 里跑往返测试。
// StarterKit 3.x 自带的东西很多（连 link、underline 都有），所以这里只需要补 Image 和 Table。
import { Image } from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import { Placeholder } from '@tiptap/extensions'
import { StarterKit } from '@tiptap/starter-kit'
import type { Extensions } from '@tiptap/vue-3'

export function createEditorExtensions(): Extensions {
  return [
    StarterKit.configure({
      // Markdown 没有下划线语法。留着它的话，用户按 Cmd+U 打出 <u>，
      // turndown 转回 markdown 时会**默默把标签丢掉只留文字**，改了却看不出来
      underline: false,

      link: {
        openOnClick: false, // 编辑器里点链接应该是定位光标，不是跳走
        // 自动把打出来的裸链接变成 <a> —— 关掉。markdown-it 那边 linkify 也是关的，
        // 两边不一致会导致「正文没动却多出一堆 markdown 链接」
        autolink: false,
        HTMLAttributes: { rel: null, target: null },
      },

      codeBlock: {
        // turndown 靠 <code class="language-xxx"> 认围栏语言，前缀必须是这个
        languageClassPrefix: 'language-',
      },
    }),

    // inline: true —— 图片留在段落里面。设成 false 会把 `文字 ![](x) 文字`
    // 这种行内图片从段落里劈出来，正文结构就被改了
    Image.configure({ inline: true, allowBase64: false }),

    TableKit.configure({ table: { resizable: true } }),

    Placeholder.configure({ placeholder: '正文从这里开始。图片可以直接粘贴或拖进来。' }),
  ]
}
