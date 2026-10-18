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

## 空间站搜刮行动

登录后访问 `/salvage`，进入单人随机地图搜刮容器、战胜多种人机并前往撤离点。地图采用不规则舱站布局，设有不可通行的隔离墙，撤离平台会出现在地图外沿附近；容器、人机、装备和物品均使用内嵌 SVG 插画。成功撤离的收集品会进入个人仓库，可出售换取本玩法独立的星币；星晶用于武器充能。背包、武器与六种外观各异的护甲分为 1～6 级，制造商可并行排产，护甲可维修但每次维修都会降低耐久上限。混乱区有装备价值门槛，敌人与掉落物资更强；生命值归零会丢失本局带入及搜刮的全部物品。相关 D1 表与索引会随数据库 schema 初始化自动创建。

## 即时通知

经典 UI 的左侧导航按 Overview、Community、Build、Apps、Account 和 Administration 分组。登录后的 HTML 页面会每 2 秒检查一次即时通知并在页面内弹窗；浏览器提及通知轮询间隔为 3 秒。仅 UID 1 的已登录会话可以发送即时通知：`GET /api/noti?u=<接收UID>&t=<标题>&c=<内容>`。通知轮询接口为登录态 `GET /api/noti/poll?after=<通知ID>`；浏览器使用用户本地游标避免重复显示。
