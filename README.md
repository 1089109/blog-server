# Blog Server v2

基于 **Express + Sequelize + TypeScript**，面向 **Node 22** 重构的博客后端。

## 与 blog-server 的关系

- API 路径与响应格式与旧版 `blog-server` **完全兼容**（91 个接口）
- 数据库仍使用现有 MySQL `blog` 库，无需迁移表结构
- 文件上传支持本地 `files/` 目录或阿里云 OSS

## 快速开始

```bash
cd server
cp .env.example .env
npm install
npm run dev    # http://localhost:8010
```

生产部署：`npm run build && pm2 start ecosystem.config.cjs`

## 端口

- 开发 / 生产默认：**8010**
- 前台 `web` 开发地址：**8011**（`CORS_ORIGIN` 默认允许该源）

## 环境变量

见 `.env.example`（`DB_*`、`JWT_SECRET`、`OSS_*`、`CORS_ORIGIN`）。

## 架构

- `src/models/` — Sequelize 模型（15 张业务表，结构对齐 `blog_20260616.sql`）
- `src/utils/db.ts` — Sequelize 驱动的 `db.query` 兼容层
- `src/routes/` — 与旧 blog-server 一致的路由

**自动建表**：启动时 `ensureTablesExist()` 检查表是否存在，缺失则 `model.sync()` 创建（可通过 `DB_AUTO_SYNC=false` 关闭）。

新功能建议直接使用 Sequelize Model，逐步替换 raw SQL。
