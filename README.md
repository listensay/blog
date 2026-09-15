# 个人博客

基于 Nuxt Content。评论、点赞、阅读量与评论管理使用 SQLite：本地为 `better-sqlite3`，
Cloudflare Workers 上为 D1。

## 命令

| 命令 | 作用 |
| --- | --- |
| `npm install` | 安装依赖 |
| `npm run dev` | 开发服务器，`http://localhost:3000` |
| `npm run build` | 构建 |
| `npm run preview` | 本地预览构建产物 |
| `npm run deploy` | 构建并部署到 Cloudflare Workers |

pnpm、yarn、bun 同样可用。

## 中英文页面

使用 `@nuxtjs/i18n`，中文地址保持不变，英文站点位于 `/en`。页头右上角通过带国旗的真实链接切换语言（中文：中国国旗；English：美国国旗）；
有译文时通过模块的 `useSwitchLocalePath()` 打开对应页面，保留查询参数和锚点；没有译文时打开另一种语言的文章列表。

- 中文文章：`content/blog/<目录>/<文件名>.md`。
- 英文文章：`content/en/blog/<同一目录>/<文件名>.md`，与原文保持相同的 `slug`。
- 英文独立页面：`content/en/pages/`，文件路径与 `content/pages/` 对应。
- 界面文案：`i18n/locales/zh-CN.json`、`i18n/locales/en.json`，组件通过 `t()` 读取。
- 英文站点摘要、个人简介和分类/标签显示名：`i18n/locales/en.json` 的 `site`、`taxonomy`。
- 中文站点设置与自定义菜单继续使用 `content/data/site.json`、`nav.json`；英文常用菜单名称使用 `nav` 翻译键，自定义菜单可在 `SiteHeader.vue` 的 `navKeys` 增加对应键。

目前已提供 `free-ai`、`ai-logo-generation`、`codehack-jetbrains` 三篇文章，以及关于和友情链接的英文版本。其他文章可逐篇增加译文。
文章标题、摘要、正文单独保存在英文 Markdown 中。分类和标签沿用中文原文的值，
按稳定的 URL slug 在 `taxonomy` 中查找英文显示名（例如 `benefits` 对应 `Benefits`）。
英文内容建议用 `/images/...` 引用图片，避免不同目录深度造成相对路径错误。

在本地管理后台的文章列表点击「添加英文版」或「管理英文版」，也可在已保存文章的编辑页点击
「英文版」→「AI 翻译英文版」。列表可按未翻译、英文草稿、已发布和待更新筛选。可以修改标题、摘要和
Markdown、预览译文，最后保存为英文草稿或发布版本。翻译复用后台现有的 AI 配置，
生成不会自动保存；保存到本地的发布版本在下次站点部署后上线。详见 [后台文档](admin/README.md#文章英文版)。

两种语言各自输出 canonical，只有已发布且双方存在的页面才输出双向 hreflang。
站点地图自动包含英文页面；英文 RSS 为 `/en/feed.xml`。正文在服务端渲染，
不会依赖浏览器实时翻译。文章的评论、点赞和阅读量按原有 slug 共用。

启动开发服务器后，可以检查两种语言的收录配置和页面行为：

```bash
npm run check:locales -- http://127.0.0.1:3000
```

## 环境变量

复制 `.env.example` 为 `.env` 后填写，修改后需重启开发服务器。`.env` 不进 git。

| 变量 | 说明 |
| --- | --- |
| `NUXT_ADMIN_PASSWORD` | `/admin` 的登录密码，可为纯数字。未设置时评论管理后台整体关闭 |
| `NUXT_SESSION_SECRET` | 管理会话 cookie 的签名密钥，用 `openssl rand -hex 32` 生成 |
| `NUXT_VISITOR_SALT` | 访客指纹盐值。更换后浏览计数与点赞去重的判定重置 |

## 部署到 Cloudflare

评论与点赞依赖服务端 API 与 D1，不能使用 `npm run generate` 的静态产物部署，须使用项目内的
Worker 配置。

线上密钥通过 wrangler 设置，首次部署或更换密钥时执行：

```bash
npx wrangler secret put NUXT_ADMIN_PASSWORD
npx wrangler secret put NUXT_SESSION_SECRET
npx wrangler secret put NUXT_VISITOR_SALT
```

部署：

```bash
npm run deploy
```

验证：

```bash
curl https://<域名>/api/admin/session
```

返回 `{"enabled":true,"authed":false}` 表示配置生效。

由 GitHub 自动部署时，相关提交须先推送到部署所用的分支。
