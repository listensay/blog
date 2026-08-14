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
