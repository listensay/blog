# 个人博客

基于 Nuxt Content，评论、点赞、阅读量和评论管理使用 SQLite：本地走
`better-sqlite3`，Cloudflare Workers 上走 D1。

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

先复制并填写本地环境变量：

```bash
cp .env.example .env
```

`NUXT_ADMIN_PASSWORD` 可以使用纯数字密码，例如 `123456`。修改 `.env` 后需要
重启开发服务器，已经启动的进程不会自动重新读取密钥。

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

### 部署到 Cloudflare

评论和点赞依赖服务端 API 与 D1，不能使用 `npm run generate` 产生的纯静态目录部署。
应使用项目内的 Worker 配置：

```bash
npx wrangler secret put NUXT_ADMIN_PASSWORD
npx wrangler secret put NUXT_SESSION_SECRET
npx wrangler secret put NUXT_VISITOR_SALT
npm run deploy
```

三个 secret 只需首次设置或修改时执行。部署完成后可检查：

```bash
curl https://你的域名/api/admin/session
```

应返回 `{"enabled":true,"authed":false}`。如果线上由 GitHub 自动部署，务必先把
评论/点赞相关提交推送到部署所使用的分支。

## 站点设置

站点名字、描述、头像、社交链接这些都在 `content/data/site.json`，`app/utils/site.ts`
把它静态 import 进来当 `siteConfig`（和菜单同一套路子）：

```json
{
  "profile": {
    "name": "Immki",
    "bio": "了解真相才能获得真正的自由。",
    "avatar": "/images/avatar.jpg",
    "socials": [
      { "icon": "github", "label": "GitHub", "url": "https://github.com/x", "color": "#24292f" }
    ]
  },
  "site": {
    "title": "Immki Blog",
    "description": "了解真相才能获得真正的自由。",
    "url": "https://blog.200205.net",
    "ogImage": "/images/avatar.jpg",
    "utcOffset": "+08:00",
    "home": { "postLimit": 5, "hiddenCategories": ["docs"] }
  }
}
```

`profile` 是首页头像旁「我是谁」那块，`site` 是 SEO / RSS / sitemap 读的站点元信息。
所以 **`profile.name`（首页那个大名字）和 `site.title`（浏览器标签页）是两个字段**，
`profile.bio` 和 `site.description` 也是 —— 简介留空时会自动退回用网站描述。

不用手改这个文件，后台有「社交设置」和「系统设置」两页，校验比手写严得多
（详见 [admin/README.md](admin/README.md#站点设置)）。改完**要重启 dev server**：
静态 import 的东西，已经跑起来的进程不一定重新读。

`socials[].icon` 的取值列在 `app/utils/site.ts` 的 `SOCIAL_ICONS` 里（20 个，
邮箱、QQ、微信、GitHub、B 站、知乎、掘金、X、Telegram……），每一个都要在
`SocialIcon.vue` 的映射表里有对应的 Tabler 图标 —— 那张表的类型是
`Record<SocialIconName, …>`，漏一个直接类型报错。

`avatar` 和 `ogImage` 要写**站点上真实存在的地址**（`/images/x.jpg`）或 http 链接。
和友链头像同一个坑：frontmatter 里只有 `cover` 会被 `image-src` transformer 改写成站点 URL，
这两个字段不会 —— 写相对路径的话本地编辑器里看得见、线上是 404。

`home.hiddenCategories` 填分类的**英文 slug**（`docs`、`python`），这些分类的文章不出现在
首页，分类页和 RSS 仍然有。

**这个 JSON 是站点的硬依赖，别删** —— 和 `nav.json` 一样，解析不到连 `npm run dev` 都起不来。
里面的坏数据不会把站点带崩：认不出的图标名、颜色、时区、条数都会换成兜底值，
没写地址的社交条目会被整条丢掉（见 `site.ts` 里的 `toSocialLink` 和那组 `DEFAULTS`）。

## SEO

页面元信息统一走 `app/composables/useSeo.ts`，各页面只需要给「不含站点名的标题」和描述，
canonical、`og:*`、`twitter:*` 由它补齐。标题的站点名后缀来自 `app/plugins/head.ts` 的
`titleTemplate`（内页「页面标题 - 站点名」，首页不传标题所以只有站点名）—— 放在插件里是因为
出错时 `error.vue` 会**整体替换** `app.vue`，写在 app.vue 里的 `useHead` 在 404 页上不执行。

结构化数据用同一个文件里的 `useJsonLd`：首页输出 WebSite + Person，文章页输出 BlogPosting +
面包屑。`/sitemap.xml` 和 `/robots.txt` 是服务端路由（和 `feed.xml` 同一套写法），域名只有
`content/data/site.json` 的 `site.url` 一个来源（经 `app/utils/site.ts` 读出来）。
上线后记得去 Google Search Console 提交一次 sitemap。

`noindex` 的页面（`/admin`、错误页）不输出 canonical —— 既说别收录又指一个规范地址是矛盾信号。

## 写文章配图

图片文件全部放在 `public/images/`，**正文里写相对路径**：

```markdown
![说明](../../public/images/xxx.png)
```

这个写法 Typora、Obsidian、VS Code 预览和 GitHub 网页都原生认，写稿时能直接看到图。
构建时由 `transformers/image-src.ts` 解析成站点 URL `/images/xxx.png` 存进内容库，
所以线上拿到的是短路径，前端和 RSS 都不用另做处理。

不要在正文里直接写 `/images/xxx.png`：前端正常，但 Typora 会把前导 `/` 当文件系统根、
Obsidian 不认带前导斜杠的库内路径，两个编辑器都预览不出来。已经写成绝对路径、
`https://` 或 `data:` 的图 transformer 一律不动，老文章不用跟着改。

相对路径如果解析后不在 `public/` 里，transformer 会原样保留并在构建日志打
`[image-src]` 警告 —— 看到这个警告就说明那张图线上会 404。**文件名不要带裸空格**，
`![](a b.png)` 会直接解析不成图片（连警告都不会有）；`%20` 和中文文件名都没问题。

三个编辑器的粘贴设置（配好之后粘贴截图会自动落到 `public/images/` 并插入正确路径）：

- **Typora**：偏好设置 → 图像 → 插入图片时选「复制到指定路径」，路径填 `../../public/images`，并勾选「优先使用相对路径」。
- **Obsidian**（库根就是项目根，`.obsidian` 已 gitignore，仓库里的 `.obsidian/app.json` 已配好）：设置 → 文件与链接 → 「新附件的默认位置」选「在下面指定的文件夹中」填 `public/images`；「新链接格式」选「相对于当前笔记的路径」；**关掉「使用 [[Wiki 链接]]」**，否则写出来的 `![[x.png]]` 不是标准 Markdown，@nuxt/content 不认。
- **VS Code**：`.vscode/settings.json` 里的 `markdown.copyFiles.destination` 已配好，直接粘贴即可。

## 文章分类与英文链接

文章可以按英文目录整理，例如：

```text
content/blog/ai/
content/blog/python/
content/blog/docs/
```

英文目录会进入公开网址。每篇文章仍在 frontmatter 中设置展示分类和英文文章链接：

```yaml
---
title: Python 入门
slug: python-getting-started
category: Python
tags:
  - Python
  - 教程
---
```

文章地址为 `/blog/python/python-getting-started`，分类和标签地址也会统一转换成英文 slug。
常用中文名称到英文 slug 的映射集中在 `app/utils/taxonomy.ts`，新增中文分类或标签时可在
`TAXONOMY_ALIASES` 中补一个可读的英文名称。

首页默认不显示 `Docs` 分类。需要调整时改后台「系统设置」里的「首页隐藏的分类」
（存到 `content/data/site.json` 的 `site.home.hiddenCategories`）；这里填分类的英文 slug，
例如 `docs`、`python`。

## 固定页

文章之外的页面（关于、友情链接……）放在 `content/pages/`，**文件名就是网址**：

```text
content/pages/about.md   →  /about
content/pages/links.md   →  /links
```

渲染由 `app/pages/[...page].vue` 这个通吃路由负责，所以**加一个 md 文件就有一个页面**，
不用写 .vue。文件名会原样进 URL，因此只用小写字母、数字和连字符（中文文件名会变成
`/%E5%85%B3%E4%BA%8E` 那种网址）。

想给某个页面做特殊排版，就在 `app/pages/` 下写一个同名 .vue —— 静态路由的优先级比通吃
路由高，会盖过它。`/links` 就是这么干的（它要渲染友链卡片）。反过来说，**别建和站点已有
页面同名的固定页**（`blog`、`categories`、`tags`、`admin`、`index`），那个 md 文件永远
不会被访问到，而且不会有任何报错。后台会拦住这种文件名。

固定页的 frontmatter 里**不要写 `slug`**：页面的网址就是文件名，写了也不会生效
（`slug-path` transformer 只管 blog 集合）。

友情链接的条目写在 `content/pages/links.md` 的 frontmatter 里：

```yaml
---
title: 友情链接
friends:
  - name: 某个博客
    url: https://example.com
    description: 一句话
    avatar: /images/x.png
---
```

`avatar` 要写**站点上真实存在的地址**（`/images/x.png`）或 http 链接。frontmatter 里只有
`cover` 会被 `image-src` transformer 改写成站点 URL，`avatar` 不会 —— 写相对路径的话本地
编辑器里看得见图、线上是 404。

## 顶部菜单

菜单数据在 `content/data/nav.json`，`app/utils/site.ts` 把它 import 进来当 `siteConfig.nav`：

```json
[{ "label": "About", "to": "/about", "icon": "about", "color": "#06b6d4" }]
```

`icon` 的取值列在 `app/utils/site.ts` 的 `NAV_ICONS` 里，每一个都要在 `SiteHeader.vue` 的
`navIcons` 映射表里有对应的 Tabler 图标（那张表的类型是 `Record<NavIcon, …>`，漏一个直接
类型报错）。

菜单是静态 import 进来的（每个页面都要渲染，运行时查一次不值得），所以**这个 JSON 是
站点的硬依赖，别删** —— 解析不到的话连 `npm run dev` 都起不来。里面的坏数据不会把站点
带崩：图标名或颜色不认识会换成兜底值，文字或路径空着的那一条会被整个丢掉
（见 `site.ts` 的 `toNavItem`）。

## 本机管理后台

`admin/` 是一个独立的 Vue + Vite 应用，用来管文章、固定页、友链、菜单、图片和站点设置，
**只在本机跑、不部署**。详见 [admin/README.md](admin/README.md)。
