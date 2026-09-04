import { Image } from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import { StarterKit } from '@tiptap/starter-kit'
import type { Extensions } from '@tiptap/vue-3'

import { Details, DetailsSummary } from './details.ts'

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

    Details,
    DetailsSummary,
  ]
}
