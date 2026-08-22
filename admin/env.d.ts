/// <reference types="vite/client" />

/*
 * ant-design-vue 把 `GlobalComponents` 声明放在 typings/global.d.ts 里，但 package.json
 * 没有 types 字段指过去，默认不会生效。显式引进来之后，模板里写错组件名
 * （`<a-inpt>`、或者用了这个版本没有的组件）会变成类型错误而不是运行时空白。
 */
/// <reference types="ant-design-vue/typings/global" />

/**
 * turndown-plugin-gfm 没有随包发类型声明，这里补上用到的那几个导出。
 * `TurndownService.Plugin` 来自 @types/turndown。
 */
declare module 'turndown-plugin-gfm' {
  import type TurndownService from 'turndown'

  export const gfm: TurndownService.Plugin
  export const tables: TurndownService.Plugin
  export const strikethrough: TurndownService.Plugin
  export const taskListItems: TurndownService.Plugin
  export const highlightedCodeBlock: TurndownService.Plugin
}
