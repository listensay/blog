# Immki Blog

基于 Nuxt 的个人博客，支持文章、日记和作品展示，集成本地内容管理与读者互动功能，可部署至 Cloudflare Workers。

## 功能

- **内容发布**：文章、日记、独立页面和作品集，支持草稿、分类、标签及封面。
- **本地写作**：集成 AFFiNE 编辑器，支持富文本、白板、自动保存和导入导出。
- **读者互动**：评论、回复、点赞、阅读统计及评论管理。
- **站点管理**：配置个人资料、导航菜单、友情链接和首页展示，管理图片资源。
- **阅读与订阅**：响应式布局、文章目录、图片预览、RSS 和站点地图。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前台 | Nuxt 4、Vue 3、Nuxt Content、Tailwind CSS |
| 内容管理 | AFFiNE、Vite、Ant Design Vue |
| 数据存储 | SQLite、Cloudflare D1 |
| 部署 | Cloudflare Workers |

## 快速开始

环境要求：Node.js 22.18 或更高的 22.x 版本、npm、Git。

在克隆后的项目目录中安装依赖并启动前台：

```bash
npm install
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)。

在另一终端安装并启动本地内容管理后台：

```bash
npm --prefix admin install
npm run affine:build
npm run admin
```

访问 [http://127.0.0.1:5173](http://127.0.0.1:5173)。首次构建会下载编辑器源码并安装依赖。

在编辑器中完成写作后，选择“发布到博客”更新本地预览。线上内容通过重新部署更新。

## 配置

启用评论管理前，复制环境变量示例并填写配置：

```bash
cp .env.example .env
```

| 环境变量 | 用途 |
| --- | --- |
| `NUXT_ADMIN_PASSWORD` | 评论管理密码 |
| `NUXT_SESSION_SECRET` | 管理会话签名密钥 |
| `NUXT_VISITOR_SALT` | 访客标识与互动去重 |

密钥可使用 `openssl rand -hex 32` 生成。修改配置后重启开发服务。

网站标题、个人资料、导航和友情链接可在本地后台设置。

## 部署

生产环境使用 Cloudflare Workers 和 D1。首次部署前，配置自己的 Workers 项目、域名及 D1 数据库，并在 Cloudflare 中设置上述环境变量。

```bash
npm run deploy
```

本地内容管理后台在开发机器上运行。

## 开发命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动前台开发服务 |
| `npm run admin` | 启动本地内容管理后台 |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览构建产物 |
| `npm run check:site` | 检查站点页面与收录配置，需先启动前台 |
| `npm --prefix admin run check` | 检查后台类型与功能 |
