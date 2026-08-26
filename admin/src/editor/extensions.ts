import { Image } from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import { Placeholder } from '@tiptap/extensions'
import { StarterKit } from '@tiptap/starter-kit'
import type { Extensions } from '@tiptap/vue-3'

export function createEditorExtensions(): Extensions {
  return [
    StarterKit.configure({
      underline: false,

      link: {
        openOnClick: false,
        autolink: false,
        HTMLAttributes: { rel: null, target: null },
      },

      codeBlock: {
        languageClassPrefix: 'language-',
      },
    }),

    Image.configure({ inline: true, allowBase64: false }),

    TableKit.configure({ table: { resizable: true } }),

    Placeholder.configure({ placeholder: '正文从这里开始。图片可以直接粘贴或拖进来。' }),
  ]
}
