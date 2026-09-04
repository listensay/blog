# blog 管理后台

`blog` 仓库的本地管理界面，维护文章、固定页、友情链接、顶部菜单、站点设置与图片。

Vue 3 + Vite + ant-design-vue。文件读写接口以 Vite 插件形式挂在 dev server 上，无独立后端进程。

> **仅限本机运行，不部署。** 接口无鉴权。dev server 只监听 `127.0.0.1`，接口以 `apply: 'serve'`
> 注册，`vite build` 产出的 `dist/` 不含该接口。

## 运行

```sh
npm install
npm run dev          # http://127.0.0.1:5173
```

仓库根目录默认取 admin 的上一级，可用 `ADMIN_BLOG_ROOT` 覆盖：

```sh
ADMIN_BLOG_ROOT=~/Desktop/工作台/blog npm run dev
```

界面为左侧固定侧边栏加右侧内容区。侧边栏分区：文章、页面、链接、菜单、社交设置、系统设置。
右上角显示仓库路径与文章、页面、图片数量。

## 环境变量

置于 `.env.local`。修改后需重启 dev server。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `ADMIN_BLOG_ROOT` | `..` | blog 仓库根目录 |
| `ADMIN_AI_API_KEY` | — | 未设置时 AI 功能禁用 |
| `ADMIN_AI_BASE_URL` | 见 `.env.example` | OpenAI 兼容的 API 地址 |
| `ADMIN_AI_MODEL` | 见 `.env.example` | 模型名 |
| `ADMIN_AI_TIMEOUT_MS` | `300000` | 单次请求超时 |
| `ADMIN_AI_MAX_TOKENS` | 不传 | 不传时由供应商决定 |

AI 使用 OpenAI 兼容的 `/chat/completions`。密钥只在 Node 侧读取。启动时控制台输出当前模型。

## 架构

```
浏览器 ── /api/*         ──→ server/  ──→ ../content/blog/**.md      文章
       │                                 ../content/pages/**.md     固定页
       │                                 ../content/data/nav.json   顶部菜单
       │                                 ../content/data/site.json  站点设置
       └─ /blog-public/* ──→            ../public/           （编辑器内的图片预览）
```

| 管理对象 | 数据位置 | 写入粒度 |
| --- | --- | --- |
| 文章 | `content/blog/**.md` | 单文件 |
| 固定页 | `content/pages/**.md` | 单文件 |
| 友情链接 | `content/pages/links.md` 的 `friends` | 整个数组 |
| 顶部菜单 | `content/data/nav.json` | 整份文件 |
| 站点设置 | `content/data/site.json` | 整份文件 |
| 图片 | `public/images/` | 单文件 |

`content/data/*.json` 由站点侧 `app/utils/site.ts` 静态 import，为站点的硬依赖，修改后需重启
站点 dev server。

## 接口

| 方法与路径 | 作用 |
| --- | --- |
| `GET /api/workspace` | 仓库路径、文章数、页面数、图片数 |
| `GET /api/posts` | 文章列表，附分类 / 标签 / 子目录候选 |
| `GET /api/post?file=` | 读一篇，含正文与整份 frontmatter |
| `POST /api/post` | 新建 |
| `PUT /api/post?file=` | 保存，可同时改名与换目录 |
| `DELETE /api/post?file=` | 移入 `admin/.trash/` |
| `GET /api/pages` | 页面列表，附保留文件名 |
| `GET /api/page?file=` | 读一个页面，含正文、`friends`、整份 frontmatter |
| `POST /api/page` · `PUT /api/page?file=` · `DELETE /api/page?file=` | 同文章 |
| `GET /api/nav` · `PUT /api/nav` | 顶部菜单 |
| `GET /api/settings` · `PUT /api/settings` | 站点设置，附图标与分类候选 |
| `GET /api/images` · `POST /api/images?name=` | 列图 / 存图 |
| `GET /api/ai` | AI 配置状态，不含密钥 |
| `POST /api/ai` | 执行一个 AI 动作 |

`file` 为相对 `content/` 的路径。文章接口只接受 `blog/` 开头，页面接口只接受 `pages/` 开头，
拒绝 `..`、绝对路径与非 `.md` 文件。

## 写入规则

适用于文章与固定页。

| 规则 |
| --- |
| 删除为软删除，移入 `admin/.trash/` 并在文件名前加时间戳，页面另加 `pages__` 前缀 |
| 仅修改 frontmatter 时，正文原样写回，字节不变 |
| 整份原始 frontmatter 回传服务端，未识别的键写回原位置，包含空值键 |
| 换目录时重算正文图片的 `../` 层数 |
| 校验通过后才落盘，失败时不写入任何内容 |

## 文章

### 日期

格式固定 `YYYY-MM-DD HH:mm`。

| 情况 | 行为 |
| --- | --- |
| 仅含日期的文件 | 按当天 `00:00` 显示；未修改时间则不改写原行 |
| 时刻为 `00:00` | 视为仅知日期，页面不显示时刻 |

站点侧 `content.config.ts` 中 `date` 为 `z.string()`，列类型 `VARCHAR`。格式化逻辑在
`app/utils/date.ts`，不经过 `Date` 对象。

### slug

决定文章 URL，由 `slug-path` transformer 处理。同目录下 slug 重复时保存返回 409。

## 固定页

文件名即网址：`pages/about.md` → `/about`。pages 集合的 `prefix` 为 `/`，无 slug 字段。

| 项 | 规则 |
| --- | --- |
| 文件名字符集 | 小写字母、数字、连字符 |
| 保留文件名 | `blog`、`categories`、`tags`、`admin`、`index` |
| 改名或删除 | 更换网址，确认框列出指向旧网址的菜单项 |
| frontmatter `slug` | 不生效 |
| 路由 | `app/pages/[...page].vue` 覆盖全部 `content/pages/**` |

保留名单由 `GET /api/pages` 的 `reserved` 提供。

站点侧有专属 .vue 的页面为例外，名单见 `server/pages.ts` 的 `CUSTOM_ROUTE_FILES`：删除或改名后
渲染为标题回退、内容为空的页面，不返回 404。`/links` 属于此类，不在保留名单中。

## 友情链接

条目存于 `pages/links.md` 的 `friends`，仅 `/links` 页面显示该编辑器。支持增删与上下移动，
顺序即页面卡片顺序。

| 字段 | 规则 |
| --- | --- |
| `name` | 必填 |
| `url` | 必填，须带协议或以 `/` 开头 |
| `description` | 可选 |
| `avatar` | 可选，站内绝对路径或 http 链接，不接受相对路径 |

空白条目在保存时忽略。`friends` 由后台独占维护，是唯一不保留未识别键的位置，键序、引号与空值
写法会被归一化。

## 顶部菜单

数据在 `content/data/nav.json`，站点侧 import 为 `siteConfig.nav`。整份数组一起保存。

| 字段 | 规则 |
| --- | --- |
| `label` | 必填 |
| `to` | 必填，须以 `/` 开头，只接受站内地址 |
| `icon` | 须在图标白名单内 |
| `color` | `#rrggbb` |
| — | 两项不可指向同一地址 |

图标白名单存在两份：

| 位置 | 用途 |
| --- | --- |
| `server/nav.ts` | 带中文说明，供后台下拉使用 |
| `app/utils/site.ts` 的 `NAV_ICONS` | `SiteHeader.vue` 构建 `Record<NavIcon, 组件>` |

`npm run check` 对两份列表执行 `deepEqual`。站点侧 `toNavItem` 对坏数据兜底：图标名或颜色无效
时替换为兜底值，`label` 或 `to` 为空时丢弃整条。

`nav.json` 不存在时保存一次即创建；解析失败时接口返回 200 并附错误原因。

## 站点设置

社交设置与系统设置修改同一个文件 `content/data/site.json`。

| 页面 | 字段 | 键 |
| --- | --- | --- |
| 社交设置 | 名字、个人简介、头像、社交链接 | `profile.*` |
| 系统设置 | 网站标题、网站描述、站点地址、分享图、时区、首页条数与隐藏分类 | `site.*` |

`profile` 用于首页个人信息，`site` 用于 SEO、RSS 与 sitemap。`profile.bio` 为空时取
`site.description`。两页整份读取、整份写入，读取失败时保存按钮禁用（`useSettings.ts` 的
`canSave`）。

| 字段 | 规则 |
| --- | --- |
| `profile.name` | 必填，≤ 40 字符 |
| `profile.bio` | 可选，≤ 300 字符 |
| `profile.avatar` | 站内绝对路径或 http 链接 |
| `profile.socials[].icon` | 须在社交图标白名单内 |
| `profile.socials[].label` | 必填，≤ 24 字符 |
| `profile.socials[].url` | 必填，须以 `http(s)://`、`mailto:`、`tel:` 或 `/` 开头，不可重复 |
| `profile.socials[].color` | `#rrggbb` |
| `site.title` | 必填，≤ 60 字符 |
| `site.description` | 可选，≤ 300 字符 |
| `site.url` | 必填，完整 http(s) 地址，保存时去除结尾斜杠 |
| `site.ogImage` | 站内绝对路径或 http 链接 |
| `site.utcOffset` | `+08:00` 形式 |
| `site.home.postLimit` | 1–50 的整数 |
| `site.home.hiddenCategories` | 英文 slug 数组，小写字母、数字、连字符 |

空白社交条目在保存时忽略。`site.json` 解析失败时接口返回 200，界面显示默认值并附错误原因。

隐藏分类的候选项由 `server/settings.ts` 的 `loadSlugFn` 动态 import 站点侧
`app/utils/taxonomy.ts` 计算。取不到时不提供候选项，该字段改为手动填写。

社交图标白名单存在三份：

| 位置 | 用途 |
| --- | --- |
| `app/utils/site.ts` 的 `SOCIAL_ICONS` | 唯一来源 |
| `server/settings.ts` 的 `SOCIAL_ICONS` | 带中文说明，供后台下拉使用 |
| `src/utils/social-icons.ts` | SVG 路径表，后台自行绘制图标 |

`npm run check` 中两条用例分别比对列表与路径表。站点侧 `SocialIcon.vue` 的映射表类型为
`Record<SocialIconName, …>`，未识别的图标名兜底为「个人主页」。

## 编辑器

文章与固定页共用，提供「富文本」与「Markdown 源码」两个标签，保存时以当前标签为准。转换在
`src/utils/markdown.ts`，去程 `markdown-it`、回程 `turndown`。

转换会规范化以下写法：

| 输入 | 输出 |
| --- | --- |
| `>引用` | `> 引用` |
| `|a|b|` | `| a | b |` |
| 松散列表 | 紧凑列表 |
| 行尾两个尾随空格 | CommonMark 反斜杠 `\` |
| 词中间的 `\_` | `_`（代码块与行内代码不受影响） |

富文本不支持原始 HTML、任务列表与脚注，`<details>` 折叠块除外。打开含这些语法的文件时给出提示并
默认停在「Markdown 源码」标签。

图片支持粘贴与拖入，存至 `public/images/`，正文写相对路径。文件名中的空格替换为 `-`。相同内容
重复上传复用已有文件。

### 折叠块

节点定义在 `src/editor/details.ts`，工具栏「折叠块」插入。回程固定输出下列格式：

```html
<details>
<summary><h3>标题</h3></summary>

正文

</details>
```

| 项 | 规定 |
| --- | --- |
| 标题层级 | `h3`，位于 `<summary>` 内 |
| `<summary>` 内容 | 纯文本，不接受图片、链接、加粗与 markdown |
| `<summary>` 与正文之间 | 一个空行 |
| 标题中的 `&`、`<`、`>` | 转为 HTML 实体 |
| 编辑器内的展开状态 | 始终展开，`open` 不写入文件 |
| 标题内按回车 | 光标移至正文 |
| 标题内的块级按钮 | 禁用（标题层级、列表、引用、代码块、分割线、折叠块、表格、图片） |
| 站点侧样式 | `app/assets/css/main.css` 的 `.prose-cn :where(details…)`，原生 `<details>` 行为 |

只有「`<details>` 与 `</details>` 成对、且每个 `<summary>` 的内容是纯文本或纯文本 `hN`」的写法算富文本支持。
其余写法（`<summary>` 内夹其他标签、`<summary>` 未闭合、`<details>` 带属性、缺 `<summary>`）按原始 HTML
处理，给出提示并默认停在「Markdown 源码」标签。

## AI 功能

| 动作 | 入口 | 作用范围 |
| --- | --- | --- |
| `polish` 润色 | AI 按钮 | 选中部分，无选中则全文 |
| `condense` 精简 | AI 按钮 | 同上 |
| `expand` 扩写 | AI 按钮 | 同上 |
| `meta` 生成标题 / slug / 摘要 / 标签 | AI 按钮 | 全文 |
| `fix` 修复格式 | 独立按钮 | 全文 |

选区在打开菜单时记录，并在发起请求前固定。结果在弹窗中提供行级对比与可编辑文本，确认后写入
正文，写入为一次可撤销的编辑事务。

### 修复格式的处理项

| 项 | 说明 |
| --- | --- |
| 标题层级 | 归一到从 `##` 起，保持相对层级，跳级接上 |
| 多余转义 | `**1\. 更新软件源**` → `**1. 更新软件源**` |
| 语言标签 | 代码块上方单独一行 `Bash` 合入围栏为 ```` ```bash ```` |
| 垃圾行 | 单独的 `\`、行尾空格、围栏旁的空引用行、三行以上连续空行 |
| 列表与表格 | 缩进与标记规范化 |
| 中英文间距 | 仅在明显缺失时补一个空格 |

正文最高级标题为 `##`，文章页已将 frontmatter 的 `title` 渲染为 `<h1>`。

### 结果校验

提示词约束在 `server/ai.ts`，结果校验在 `src/utils/ai.ts` 的 `checkMarkdownIntegrity`。

| 校验项 | 改写动作 | `fix` 动作 |
| --- | --- | --- |
| 图片地址 | 须一致，否则 `error` | 同 |
| 代码块 | 含围栏行须一致 | 只比较围栏之间的内容 |
| 标题 | 层级与数量须一致 | 只比较数量 |
| 链接 | 变动记 `warn` | 同 |
| 正文文字 | 不校验 | `proseText()` 比对，须完全一致 |

`error` 在弹窗中拦截一次，需再次确认才能替换。`proseText()` 剥离 Markdown 标记与全部空白，
仅含语言名的行被排除。

输出因长度上限截断时（`finish_reason: 'length'`）弹窗提示并指向 `ADMIN_AI_MAX_TOKENS`。

### 生成 frontmatter 字段

一次调用产出标题、slug、描述、标签，各自独立勾选。默认空值填充、已有值不动。

| 字段 | 默认勾选 | 说明 |
| --- | --- | --- |
| slug | 已有值时不勾选 | 勾选时提示将更换网址 |
| 标题 | 已有值时不勾选 | 已足够好时模型原样返回 |
| 描述 | 勾选 | — |
| 标签 | 勾选 | 追加到现有标签之后 |

输入框始终可编辑，手动修改后自动勾选。正文为空、仅有标题时可用。

slug 经 `normalizeSlug` 归一化：转小写、空白与下划线视为分隔符、合并连续连字符、剥除两端引号。
残留非法字符时判失败并清空，其余三个字段仍可用。同目录 slug 冲突时在弹窗与表单中提示，不拦截
保存。

### 性能

实测 `deepseek-v4-flash-free`：

| 输入 | 耗时 | completion tokens |
| --- | --- | --- |
| 370 字 | 104 秒 | 11104 |
| 2146 字 | 126 秒 | 15774 |

`ADMIN_AI_TIMEOUT_MS` 默认 5 分钟。

## 开发注意

- 修改 `server/**` 会触发 Vite 重启 dev server，已打开的页面需刷新。
- 接口入参名称发布后不改名。`server/ai.ts` 的 `LEGACY_ACTIONS` 保留旧动作名 `summarize`。
- `src/types.ts` 被前后端同时引用，只放纯类型，不 import 运行时代码。
- `utils/markdown.ts` 各函数的 `contentDir` 是文件相对 `content/` 的目录，如 `blog/ai`、`pages`。

## 自检

```sh
npm run check
```

| 子项 | 内容 |
| --- | --- |
| `type-check` | `vue-tsc`。`env.d.ts` 引入 `ant-design-vue/typings/global`，覆盖模板中的 `a-*` 组件名与 props |
| `check:roundtrip` | 取真实文章执行 Markdown → 富文本 → Markdown，断言图片路径一致、标题 / 围栏 / 表格 / 列表数量不变 |
| `check:api` | 启动 dev server 执行完整增删改，并逐个请求 `src/` 下每个模块 |

改动 `src/utils/markdown.ts` 或 tiptap 扩展后须运行 `check:roundtrip`。

`check:api` 将 `content/`、`public/` 与 `app/utils/taxonomy.ts` 复制到临时目录后指向该目录，
不改动真实仓库。AI 用例只测接口形状与入参校验，不调用模型；配置状态通过 `GET /api/ai` 获取。

## 目录结构

```
server/           Node 侧的本地接口（Vite 插件）
  blog-api.ts     路由表 + public 静态伺服 + 插件入口
  posts.ts        文章增删改查
  pages.ts        固定页增删改查
  nav.ts          顶部菜单读写 + 图标白名单
  settings.ts     站点设置读写 + 社交图标白名单 + 分类候选
  frontmatter.ts  frontmatter 切分与拼回，文章与页面共用
  trash.ts        软删除，文章与页面共用
  images.ts       图片存取与命名
  ai.ts           AI 配置、提示词、调用 OpenAI 兼容接口
  paths.ts        目录定位与路径安全校验
  http.ts         HTTP 胶水
src/
  types.ts        前后端共用类型
  api.ts          接口调用
  utils/markdown.ts     Markdown ⇄ HTML、图片路径换算、风险语法识别
  utils/fences.ts       逐行围栏扫描
  utils/ai.ts           结果完整性校验、行级差异、插回编辑器
  utils/nav-icons.ts    菜单图标 SVG 路径表
  utils/social-icons.ts 社交图标 SVG 路径表
  composables/useSettings.ts  设置页共用的读写、脏标记、⌘S、离开确认
  editor/extensions.ts  tiptap 扩展配置
  editor/details.ts     折叠块的 tiptap 节点
  views/          各分区页面
  components/     编辑器、图片选择器、缩略图、友链编辑器、差异视图、AI 弹窗、设置页外壳、图标
scripts/          自检脚本
```
