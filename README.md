# life-dashboard

Rosie 的个人生活仪表盘：把「今天该做什么、做了没有、学到哪了、吃了多少」收在一个界面里，
并且由 AI 每天往里填学习内容。桌面端（Tauri）+ 网页端同一份代码、云端同步。

**网页版** → https://bingbing908.github.io/life-dashboard/

## 文档

| 读什么 | 什么时候读 |
|---|---|
| **[PRODUCT.md](PRODUCT.md)** — 项目全揽 | **开工前先读这份**，一次读完就有全貌：产品是什么、有哪些模块、每个决定为什么这么定、代码在哪 |
| [CLAUDE.md](CLAUDE.md) — 实现与踩坑 | 动某个模块的代码前，查它对应那一段 |

## 技术栈

Tauri 2（Rust 壳）+ React 19 + TypeScript + Vite ·
Tailwind CSS v4 + shadcn/ui（Base UI 版）·
SQLite（桌面 tauri-plugin-sql / 浏览器 sql.js）+ Supabase 双向同步

## 常用命令

```bash
npm run dev          # 纯浏览器预览（无 Rust 环境时用这个，端口 1420）
npm run tauri dev    # 桌面应用开发模式（需要 Rust + VS Build Tools）
npm run build        # 类型检查 + 前端构建（提交前跑一遍）
```

推送到 `master` 会自动构建并部署网页版（`.github/workflows/deploy-pages.yml`）。
