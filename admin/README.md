# blog 本地后台

Vue 3 + Vite + ant-design-vue。本地服务监听 `127.0.0.1:5173`，维护 AFFiNE 工作区、作品、友情链接、菜单、社交和站点设置。前台 `/admin` 的评论管理保持独立。

```sh
npm install
npm run dev
```

后台仅在本机运行，不部署。文件接口通过 Vite 插件注册；构建产物不包含后台 API。
仓库默认取 `admin` 的上级目录，可通过进程环境变量 `ADMIN_BLOG_ROOT` 指定其他目录。

## AFFiNE 内容

原文章列表、页面列表、作品独立管理界面、富文本编辑器、AI 编辑和 AI 翻译功能已整合。旧 `/posts`、`/edit`、`/pages`、`/projects` 等入口跳转到 `/affine`。

在仓库根目录执行 `npm run affine:build`，随后运行后台，打开「AFFiNE 内容」。无需 Docker、账号或独立服务。
完整前端嵌入后台，原有文章、页面与作品自动导入，文档自动保存在本项目 SQLite 中。
右上角「发布到博客」选择内容类型（文章、页面或作品），填写发布设置并更新本地文件；作品发布自动同步更新 `content/data/projects.json`。
源码、AI 接口与备份说明见 [AFFiNE 集成](../integrations/affine/README.md)。

## 概览

概览读取文章、固定页与作品统计、近 12 个月发文趋势、最近修改和缺失元数据的提示。点击内容进入对应 AFFiNE 文档。
「清理垃圾」扫描现有内容、页面和配置的图片引用，只处理 `public/images/` 中未被引用的图片。

## 友情链接、菜单和设置

- 「链接」仅更新 `content/pages/links.md` 的 `friends`，不改 AFFiNE 管理的页面正文。缺少页面时应先在 AFFiNE 创建并发布 `slug: links` 的页面。
- 「菜单」更新 `content/data/nav.json`，支持中英文名称、图标、颜色、顺序和自定义路径。页面路径候选来自当前已发布内容。
- 「社交设置」和「系统设置」更新 `content/data/site.json`，包括个人资料、社交链接、站点信息和首页展示配置。
- 图片选择器可上传到 `public/images/`；AFFiNE 正文附件另存于 `public/affine-assets/`。

保存数据后本地预览会更新，线上需要重新构建部署。

## API

| 方法与路径 | 用途 |
| --- | --- |
| `GET /api/workspace`、`GET /api/dashboard` | 本地仓库信息及内容统计 |
| `GET /api/affine` | 本地源码工作区状态 |
| `POST /api/affine-local/invoke` | 文档存储、导入、发布和 AI 的宿主接口 |
| `GET /api/affine/export` | 下载现有内容的 Markdown ZIP 迁移包 |
| `GET /api/pages` | 菜单使用的只读页面路径列表 |
| `GET /api/links`、`PUT /api/links` | 友链读取及仅 friends 更新 |
| `GET /api/projects`、`PUT /api/projects` | 作品，写入需携带 revision |
| `GET /api/nav`、`PUT /api/nav` | 菜单 |
| `GET /api/settings`、`PUT /api/settings` | 社交和站点设置 |
| `GET /api/images`、`POST /api/images?name=` | 列图、上传 |
| `GET /api/images/unused`、`POST /api/images/cleanup` | 未使用图片扫描和清理 |

## 检查

```sh
npm run check  # 类型、菜单、API、AFFiNE 存储与发布、作品
npm run build
```

AFFiNE 检查在临时目录运行，覆盖持久化、CRDT 更新合并、附件、发布冲突和路径校验。
