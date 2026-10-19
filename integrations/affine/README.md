# AFFiNE 源码工作区

参考本机 ai-player 的集成结构，使用完整 AFFiNE Web 工作区和本项目的本地存储适配。
不运行 AFFiNE Docker、PostgreSQL、Redis 或 Rust 服务端。文档、白板、数据库视图、搜索、双链、附件和导入导出使用上游前端。
云端团队协作、账号同步和 AFFiNE 云服务不包含在本地模式内；AI 使用自己配置的 OpenAI 兼容接口。

## 运行

```sh
npm --prefix admin install
npm run affine:build
npm run admin
```

打开终端显示的后台地址（默认 http://127.0.0.1:5173/affine）。构建需要 Node 22；脚本自动使用已安装的 fnm Node 22，也可以通过 `AFFINE_NODE=/path/to/node` 指定。
首次构建安装 Yarn 依赖，后续复用。构建产物约 123 MB；源码及本机开发依赖另占约 2.7 GB，不需要构建上游服务端。

## 写作和发布

首次打开自动导入现有中英文文章、页面与作品。正文自动保存，点击文档右上角「发布到博客」选择类型（文章、页面或作品），填写地址/标识、语言、日期、简介、标签、链接和封面。
文章和作品的封面通过「上传封面」选择本地图片，可预览、更换或移除。支持 PNG、JPG、WebP、GIF、SVG、AVIF，单张最大 10 MB；确认发布时保存到 `public/affine-assets/`，自动填写封面路径，取消不会上传图片。
发布按钮左侧持续显示保存状态，与发布、导出按钮保持单行居中对齐；窄窗口使用精简文字并保留发布入口。编辑时「正在保存…」，确认文档和附件落盘后显示「已保存，尚未发布」，发布成功后显示「已发布到本地博客」。保存为草稿仍提示尚未发布；保存失败显示重试入口。状态按持久化文档版本判断，刷新后保留，再次修改会恢复未发布状态。旧数据没有发布版本记录时保守显示尚未发布。自动保存不会修改博客源文件。
左侧「博客」「页面」「作品」使用 AFFiNE 原生文件夹，支持原生右键菜单、重命名（包括同名目录）、创建子文件夹、添加文档/标签/精选和收藏；这三个顶层目录隐藏删除项，并阻止移入其他可删除目录。分类和其他子内容保留原生删除功能。初次按文章的「分类」字段建立「博客 → 分类 → 文章」层级，没有分类则归入「未分类」；页面放在「页面」目录中；作品归入「作品」目录。「全部文档」的列表和卡片视图用蓝色「博客」、紫色「页面」、青色「作品」标记内容。
点击「确认发布」更新 `content/`（文章/页面写入 Markdown，作品写入 `content/data/projects.json`）和 `public/affine-assets/`。本地 Nuxt 预览会更新，线上仍需单独构建部署。
原有文件名和路由保持不变。已发布文档暂不允许更改地址，避免留下重复页面。
内容可保存为草稿；删除 AFFiNE 文档不会删除已经发布的文件。
检测到外部源文件修改时拒绝覆盖，需要先合并。每次覆盖前备份原文件，友链列表由后台「链接」单独维护。

## 源码定制

`vendor/affine` 是固定到 `upstream.json` 版本的 Git 子模块。`local.patch` 保存本项目全部源码修改，首次构建自动应用。

- 博客入口与导入：`vendor/affine/packages/frontend/apps/web/src/blog-bridge.ts`
- HTTP 宿主桥：同目录 `blog-host.ts`
- 本地存储适配：`vendor/affine/packages/common/nbstore/src/impls/blog-local/`
- 发布表单：`vendor/affine/packages/frontend/core/src/desktop/pages/workspace/detail-page/blog-publish.tsx`
- 博客存储与发布服务：`admin/server/affine-local/`

修改源码后执行 `npm run affine:patch` 保存补丁，再执行 `npm run affine:build` 并刷新工作区。
也可用 `npm run affine:build -- --local` 直接构建尚未保存成补丁的修改。脚本不会重置用户修改。
上游及参考集成版权声明保留在源码和构建产物的 `licenses/`。

## 数据与恢复

- `.affine/workspace.sqlite`：文档、附件、工作区设置和 AI 会话；SQLite WAL 持久化。
- `.affine/backups/`：发布前的 Markdown 备份。
- `.affine/web/`：可重新生成的前端构建产物。

`.affine/` 不进入 Git。备份整个本地目录前先关闭后台；运行期间不要单独复制 SQLite 主文件而遗漏 WAL。
工作区设置中的「导出备份」可导出文档与附件。旧 Docker 已停止，原容器卷和旧迁移备份保留，不再被新后台访问。

## AI

将 `admin/.env.example` 中的 `AFFINE_AI_BASE_URL`、`AFFINE_AI_API_KEY`、`AFFINE_AI_MODEL` 填到 `admin/.env.local` 并重启后台。
支持文字写作、总结、翻译、对话和兼容模型的图片输入。图像生成需要另行接入生成服务。
