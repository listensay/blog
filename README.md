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

