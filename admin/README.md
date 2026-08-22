# blog 文章管理后台

`blog` 仓库的本地文章管理界面：列出、新建、编辑、删除 `content/blog/**.md`，
顺手管 `public/images/` 里的图片。

**只在本机跑，不部署。** 接口没有任何鉴权 —— 谁能访问这个端口，谁就能改仓库里的文件。
dev server 只监听 `127.0.0.1`，而且读写文件的那套接口用 `apply: 'serve'` 挂在 Vite 插件里，
`vite build` 出来的 `dist/` 根本不包含它，所以就算误传到线上也只是一个点不动的空壳。

## 跑起来

```sh
npm install
npm run dev          # http://127.0.0.1:5173
```

admin 默认把**上一级目录**当作 blog 仓库根（也就是 `blog/admin` → `blog`）。
放到别处的话用环境变量指过去：

```sh
ADMIN_BLOG_ROOT=~/Desktop/工作台/blog npm run dev
```

顶栏会一直显示当前在改哪个仓库，以及文章数和图片数。

## 它怎么工作

没有独立的后端进程。读写文件的接口是一个 Vite 插件（`server/blog-api.ts`），
挂在 dev server 的中间件链上，所以 `npm run dev` 一条命令就够了，也完全不用改 blog 项目的代码。

```
浏览器 ── /api/*         ──→ server/  ──→ ../content/blog/**.md
       └─ /blog-public/* ──→            ../public/           （编辑器里的图片预览）
```

| 接口 | 作用 |
| --- | --- |
| `GET /api/workspace` | 仓库路径、文章数、图片数 |
| `GET /api/posts` | 文章列表，附带分类 / 标签 / 子目录候选 |
| `GET /api/post?file=` | 读一篇（含正文和整份 frontmatter） |
| `POST /api/post` | 新建 |
| `PUT /api/post?file=` | 保存（可同时改名、换目录） |
| `DELETE /api/post?file=` | 移到 `admin/.trash/` |
| `GET /api/images` · `POST /api/images?name=` | 列图 / 存图 |

`file` 一律是相对 `content/` 的路径，如 `blog/ai/免费AI公益中转站收集分享.md`。

## 几个刻意的设计

**删除不是真删。** 文章会被移到 `admin/.trash/`，文件名前面加时间戳（`.trash` 已进 gitignore）。
误点一下能捞回来。

**正文没动过就一个字节都不改。** 只改分类、标签、日期的时候，后台原样写回原正文。
富文本往返虽然渲染结果一样，但会把表格空格、列表符号规范化，git diff 会很难看。

**frontmatter 里不认识的字段会留着。** 保存时整份原始 frontmatter 都带回服务端，
后台不认识的键原样写回原位。连「文件里本来写着一个空的 `tags:`」这种细节也保住 ——
仓库里确实有这样的文章，不能一保存就给人删一行。

**换目录时图片路径会跟着改。** 正文里的图片写的是相对路径，`../` 的层数跟文章所在目录绑定。
一篇 `blog/ai/x.md` 里的 `../../../public/images/a.png` 挪到顶层就指错地方了 ——
blog 构建时只会打一行 warn，本地预览照样有图，线上一片空白。所以保存时会重算层数。

**发布时间精确到分钟，格式固定 `YYYY-MM-DD HH:mm`。**
不带秒是刻意的：这个写法在 YAML 1.1（js-yaml 的时间戳正则要求带秒）和
YAML 1.2（core schema 压根没有时间戳类型）里**都是纯字符串**，所以没有哪一层解析会把它
变成 Date、也就没有任何时区能把日期挪走。带秒的 `09:30:00` 反而会被 YAML 1.1 当成 UTC 时间戳。

只写了日期的老文章按当天 `00:00` 显示，而且**不动时间就不会改写原来那一行** ——
判断依据是「归一化后和原文是否真的不同」，跟下面 frontmatter 空键那条是同一个原则。

站点侧已经跟着改好了（2026-08-21）：`content.config.ts` 的 `date` 从 `z.date()` 换成
`z.string()`，列类型由 `DATE` 变成 `VARCHAR`，frontmatter 里的字符串原样入库，
所以 `.order('date','DESC')` 按字典序排正好等于按时间排，**同一天的文章能按时刻排序**，
页面上也显示到分钟。原因见 content.config.ts 里的注释：@nuxt/content 把
`dateStrategy: 'format:date'` 写死了，`z.date()` 永远会被截成 `YYYY-MM-DD`。

页面显示时 `00:00` 会被当成「只知道日期」而不显示时刻（老文章迁移过来补的就是它），
格式化逻辑在 `app/utils/date.ts`，那里刻意**一步都不经过 `Date`** ——
`new Date('2026-08-19')` 按 UTC 解析、`new Date('2026-08-19 09:30')` 按本地解析，
而站点 SSR 跑在 Workers（UTC）、浏览器在 +08，一经过 Date 就既 hydration 不一致、
显示的时刻也是错的。

**slug 撞车会被拦住。** blog 的 `slug-path` transformer 用 slug 决定 URL，
同目录两篇同 slug 会直接互相覆盖，而且构建期一声不响。

## 正文编辑：富文本 + Markdown 源码两个标签

文章存的是 Markdown，tiptap 编辑的是富文本文档，中间隔着一层转换
（`markdown-it` 去、`turndown` 回，都在 `src/utils/markdown.ts`）。
保存时以**当前所在标签**为准。

转换会规范化一些写法，渲染结果不变但源码会动：

- `>引用` → `> 引用`（补一个空格）
- `|a|b|` → `| a | b |`（表格单元格补空格）
- 松散列表变紧凑列表（`<p>` 包裹这层信息在 tiptap 里就没了，无法还原）
- 行尾硬换行写成 CommonMark 的反斜杠（`\`），而不是两个看不见的尾随空格

**富文本撑不住的语法**（原始 HTML、`<details>` 折叠块、任务列表、脚注……）会在打开时被识别出来，
界面上给一条提示，并且默认停在「Markdown 源码」标签 —— 富文本会把这些结构拍平成纯文字。

图片可以直接粘贴或拖进编辑器，存到 `blog/public/images/`，正文里按仓库约定写相对路径。
文件名里的空格会换成 `-`：blog 的 image-src transformer 有个坑 ——
**文件名带裸空格的图片 markdown 根本解析不出来**，连 `<img>` 都不生成，也不告警。
同一张图重复上传会复用已有文件，不会堆一堆 `-1`、`-2`。

## 自检

```sh
npm run check
```

跑三样：类型检查、正文往返检查、接口端到端检查。

- `check:roundtrip` 拿仓库里**真实的文章**过一遍 Markdown → 富文本 → Markdown，
  断言图片路径一字不差、标题/围栏/表格/列表的数量不变，另外跑一组语法定向用例。
  改动 `src/utils/markdown.ts` 或 tiptap 扩展之后一定要跑这个。
- `check:api` 真的起一个 dev server 打全套增删改，顺带把 `src/` 下每个模块都请求一遍
  （Vite 是按请求编译的，所以模板语法错误、解析不到的 import 都会在这一步暴露）。
  它会先把 `content/` 和 `public/` 复制到临时目录再指过去，**不碰真仓库**。

`env.d.ts` 里引了 `ant-design-vue/typings/global`，所以模板里的 `a-*` 组件名和它们的 props
也在 `type-check` 的覆盖范围内 —— 写错组件名会直接报类型错误，而不是运行时一片空白。

## 目录

```
server/           跑在 Node 侧的本地接口（Vite 插件）
  blog-api.ts     路由表 + blog/public 静态伺服 + 插件入口
  posts.ts        文章增删改查
  frontmatter.ts  frontmatter 切分与拼回（正文逐字节保留）
  images.ts       图片存取与命名
  paths.ts        目录定位与路径安全校验
  http.ts         一点点 HTTP 胶水
src/
  types.ts        前后端共用的数据契约（只放类型）
  api.ts          调接口
  utils/markdown.ts  Markdown ⇄ HTML、图片路径换算、风险语法识别
  editor/extensions.ts  tiptap 扩展配置
  views/          列表页、编辑页
  components/     富文本编辑器、图片选择器
scripts/          自检脚本
```

`src/types.ts` 被两边同时引用，所以里面只放纯类型，不要 import 任何运行时代码。
