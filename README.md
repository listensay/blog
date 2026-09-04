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
