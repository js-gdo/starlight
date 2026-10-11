# StarLight Workers

基于 Cloudflare Workers + D1 的社区系统。包含文章、评论、私信、工单、举报、OJ、比赛、队伍、以及多个小游戏模块。

## 本地开发

```bash
npm install
npx wrangler dev
```

## 部署

```bash
npm run deploy
```

> 如需生成 D1 绑定类型：`npx wrangler types`

## 环境变量（Secrets / Vars）

| 变量 | 必需 | 说明 |
|------|------|------|
| `ADMIN_PASSWORD` | 首次初始化时 | 创建初始管理员（`id=1, username=lin114514`）使用的密码。**不设置则管理员以禁用态（`use=0`）创建，无法登录**，需配置后重新初始化或手动在数据库中激活。 |

通过 `npx wrangler secret put ADMIN_PASSWORD` 或 `wrangler.jsonc` 的 `vars` 配置。

> ⚠️ 安全说明：本项目已移除内置的默认管理员密码。任何已有部署若仍在用旧版内置默认口令，请务必立即通过「个人设置 → 修改密码」更换，并升级到本版本以禁用内置口令引导。

## 常用命令

| 命令 | 用途 |
|------|------|
| `npm run build` | esbuild 打包到 `dist/index.js` |
| `npm test` | 运行 vitest 测试 |
| `npm run cf-typegen` | 生成 Cloudflare 类型 |

## 目录结构

- `src/index.ts` — Worker 入口
- `src/router.ts` — 页面路由
- `src/handlers/` — `/api/*` 逻辑处理
- `src/routes/` — 页面渲染
- `src/db/` — 表结构与迁移
- `src/utils/` — 认证、权限、安全等工具
