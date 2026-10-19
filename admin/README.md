# Immki Blog Admin

Immki Blog 的本地内容管理后台，集成 AFFiNE 编辑器，用于日常写作、内容发布、图片管理和站点配置。

## 功能

- **内容编辑**：管理文章、日记、独立页面和作品，支持富文本、白板、草稿及自动保存。
- **内容概览**：查看内容统计、发文趋势、最近修改和待办事项。
- **图片管理**：上传、选择图片，清理未引用的图片。
- **站点设置**：管理个人资料、社交链接、导航菜单、友情链接和首页展示。
- **AI 辅助写作**：接入 OpenAI 兼容服务，支持写作、总结和对话。

## 技术栈

Vue 3、TypeScript、Vite、Ant Design Vue、AFFiNE、SQLite。

## 快速开始

环境要求：Node.js 22.18 或更高的 22.x 版本、npm、Git。

在仓库根目录执行：

```bash
npm install
npm --prefix admin install
npm run affine:build
npm run admin
```

访问 [http://127.0.0.1:5173](http://127.0.0.1:5173)。首次构建会下载编辑器源码并安装依赖。

在“AFFiNE 内容”中编辑文档，选择“发布到博客”更新本地内容。需要预览博客时，在另一终端运行 `npm run dev`。线上内容通过重新部署更新。

后台在开发机器上运行。博客的安装与部署说明见[项目 README](../README.md)。

## AI 配置

使用 AI 辅助写作时，将以下配置填入 `admin/.env.local`，然后重启后台：

| 环境变量 | 用途 |
| --- | --- |
| `AFFINE_AI_BASE_URL` | OpenAI 兼容服务地址 |
| `AFFINE_AI_API_KEY` | API 密钥 |
| `AFFINE_AI_MODEL` | 模型名称 |

配置示例见 [`.env.example`](.env.example)。

## 开发命令

以下命令在仓库根目录执行：

| 命令 | 用途 |
| --- | --- |
| `npm run admin` | 启动后台开发服务 |
| `npm run affine:build` | 构建内容编辑器 |
| `npm --prefix admin run build` | 类型检查并构建后台前端 |
| `npm --prefix admin run check` | 检查后台类型与功能 |
| `npm --prefix admin run lint` | 检查并修复代码风格 |
| `npm --prefix admin run format` | 格式化后台代码 |
