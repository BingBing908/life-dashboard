# life-dashboard 项目说明

Rosie 的个人工具：一个模块化仪表盘应用，包含计划表、学习记录、习惯打卡、通用小表格四个模块。中文交流。

## 技术栈

- **桌面端**：Tauri 2（Rust 壳）+ React 19 + TypeScript + Vite
- **UI**：Tailwind CSS v4 + shadcn/ui（Base UI 版本，组件在 `src/components/ui/`，注意 trigger 用 `render` prop 而不是 `asChild`）
- **数据**：SQLite。运行环境自动检测（`src/lib/db.ts`）：
  - Tauri 内 → tauri-plugin-sql，本地文件 `portwritingtool.db`，迁移定义在 `src-tauri/src/lib.rs`
  - 纯浏览器 → sql.js (WASM) + localStorage，建表 SQL 在 `src/lib/schema.ts`
  - ⚠️ 改表结构时两处 SQL 必须同步修改

## 架构约定（重要）

- **一切功能皆模块**。每个模块 = `manifest`（id/名称/图标/卡片尺寸）+ `Card`（仪表盘摘要卡）+ `Page`（完整页面），接口定义在 `src/modules/types.ts`
- 新模块在 `src/modules/<名字>/` 下自包含（index.tsx + data.ts），然后在 `src/modules/registry.ts` 注册一行即可上架
- **不要**把功能硬编码进仪表盘壳子（`src/App.tsx`、`src/components/dashboard/`）
- 所有业务表带同步预留字段：`id`(UUID)、`created_at`、`updated_at`、`device_id`、`deleted_at`（软删除，查询时过滤 `deleted_at IS NULL`）
- SQL 占位符用 `$1..$n` 顺序风格（浏览器层会自动转成 `?`）

## 部署

- **GitHub**：github.com/BingBing908/life-dashboard（master 分支）
- **网页版**：推送 master 后 GitHub Actions 自动部署到 https://bingbing908.github.io/life-dashboard/
- 网页版数据存在各浏览器本地，与桌面端不互通（待做云同步后打通）

## 常用命令

```bash
npm run dev          # 纯浏览器预览（网页开发/无 Rust 环境时用这个）
npm run tauri dev    # 桌面应用开发模式（需要 Rust + VS Build Tools）
npm run build        # 类型检查 + 前端构建
```

## 路线图

- [x] 四个核心模块 v1（2026-07）
- [x] To Do List 三栏页：今天 / 四象限待办池（☀️ 送进今天）/ 窄栏打卡 + 每周五 16:00 复盘（2026-07-19）
- [x] 日历式计划表：0-24h 日/周时间轴 + 带农历小月历（lunar-javascript）（2026-07-19）
- [ ] **Supabase 云端数据同步**（下一个大功能：所有设备共享同一份数据，需要 Rosie 注册 Supabase）
- [ ] 仪表盘卡片拖拽排布 + 布局持久化
- [ ] 打卡月度热力图、学习番茄钟
- [ ] UI 美化（Rosie 明确说过：先功能后外观）

## 工作习惯

- 完成一块有意义的改动就提交并推送（Rosie 在多台电脑间切换，靠 GitHub 同步代码）
- Rosie 的本机工具链都在 `D:\Software\DevTools`（Node/Rust/VS Build Tools/gh），新开终端可能要刷新 PATH
