# life-dashboard 项目说明

Rosie 的个人工具：一个模块化仪表盘应用。工作日在电脑/网页用，周末计划放在 iPad。中文交流。

## 技术栈

- **桌面端**：Tauri 2（Rust 壳）+ React 19 + TypeScript + Vite
- **UI**：Tailwind CSS v4 + shadcn/ui（**Base UI 版本**）
  - 组件在 `src/components/ui/`
  - ⚠️ trigger 用 `render` prop，不是 `asChild`
  - ⚠️ `<SelectValue>` 不会自动显示选中项文字，要传 render 函数：`<SelectValue>{(v) => 名字映射}</SelectValue>`，否则显示原始 value
  - 主题变量在 `src/index.css`：蓝白管理后台配色（参考 NOC 工具）；字体幼圆（`YouYuan`，非 Windows 设备回退）
- **数据**：SQLite，运行环境自动检测（`src/lib/db.ts`）：
  - Tauri 内 → tauri-plugin-sql，本地文件 `portwritingtool.db`，迁移在 `src-tauri/src/lib.rs`（`migrations()`，目前到 v3）
  - 纯浏览器 → sql.js (WASM) + localStorage（key `pwt-sqljs-db`），建表 SQL 在 `src/lib/schema.ts`
  - ⚠️ **改表结构必须三处同步**：`lib.rs` 加新 Migration + `schema.ts` 的 `SCHEMA_SQL`（新库建表）+ `schema.ts` 的 `BROWSER_MIGRATIONS`（旧浏览器库补列，幂等 ALTER）
  - SQL 占位符用 `$1..$n`；浏览器层转成编号 `?N`（不是裸 `?`，因为同一参数可能复用，如软删除 `deleted_at=$1, updated_at=$1`）

## 架构约定（重要）

- **一切功能皆模块**。每个模块 = `manifest`（id/名称/图标/卡片尺寸）+ `Card`（仪表盘摘要卡）+ `Page`（完整页面），接口在 `src/modules/types.ts`
- 新模块在 `src/modules/<名字>/` 下自包含（index.tsx + data.ts），在 `src/modules/registry.ts` 注册一行即上架
- **不要**把功能硬编码进仪表盘壳子（`src/App.tsx`、`src/components/dashboard/`）
- 所有业务表带同步预留字段：`id`(UUID)、`created_at`、`updated_at`、`device_id`、`deleted_at`（软删除，查询过滤 `deleted_at IS NULL`）
- 通用组件：`src/components/EditableText.tsx`（点文字就地编辑，回车/失焦保存，Esc 取消）

## 模块现状

注册在 `registry.ts` 的有 5 个：`todo`（待办）、`study-plan`（学练计划）、`supplement`（补剂）、`study-log`（学习记录）、`mini-table`（小表格）。
（计划表 planner 已于 2026-07-19 移除：Rosie 下班后的规划在 iPad 上做，办公时间只需待办 + 打卡。其 `plan_tasks` 表由迁移 v4 / 浏览器 `DROP TABLE` 清掉。）

- **待办 `todo`**：单一列表 + 五个筛选框（四象限 iu/in/nu/nn + 今天，可叠加筛选）。每条待办有「今天」开关（点击设/清 `due_date=今天`）和象限彩签，标题可点击就地改。右侧窄栏嵌入打卡。含**每周复盘**（`WeeklyReview.tsx`）：周一~周五完成情况，周五 16:00 起到周末页顶出现横幅，平时点「本周复盘」可看。
- **打卡 `habit-checkin`**：`HabitPanel` 组件（有 `compact` 窄栏模式，被待办页右栏复用），**未单独注册**到 registry（想拆回独立模块就在数组里加回 `habitCheckin`）。习惯名可就地改。
- **学练计划 `study-plan`**：六线周计划（养生/运动/英语/HCIP/AI方向/阅读），按 Rosie 作息表带时间段。今日视图按五大板块分组卡片展示：养生（揉腹/五脏逼毒/八段锦/泡脚[周一五六日]/睡前拉伸，视频用 Rosie 自己收藏的 B 站版本）为顶部横条，内部是**迷你卡自适应网格**（auto-fit minmax(190px,1fr)，每卡=时间+跳转图标一行、勾选+标题一行，detail 挂 title 悬停提示）；其下按时间早晚排：英语/学习(HCIP+AI)/运动/阅读 呈 2×2 田字格（窄屏自动堆叠），板块头带完成进度、全勾变「✓ 完成」。八段锦武当版（一三五日）与国局版+足弓（二四六）隔天交替。晚间运动周主题用 Rosie 收藏夹里的欧阳春晓/C戈跟练（一=瘦斜方肌，二=芭杆手臂薄背，三=太极，四=无跑跳有氧，五=骨盆稳定，六=芭杆臀腿/太极二选一，日=泡沫轴恢复）。表 `plan_items`（days: `'*'`=每天或 `'1,3,5'`，1=周一）+ `plan_checks`（每日打卡，UNIQUE(item_id,date)），迁移 v5。**今日/一周/路线**三个视图：今日可勾选、条目带跟练视频链接（Tauri 用 plugin-opener 开系统浏览器，网页开新标签）；路线页渲染 `seed.ts` 里的 `SEMESTER_PLAN`（2026 下半年 6 个月计划：每月体重目标+四线目标+每周焦点，验收日 12/27，总目标见 `SEMESTER_TARGET`——体重 ≤58 达标/56.5 优秀，55 顺延 2027Q1，50 不设）。4 周递进周期（适应/完整/加量/减载），起点存 `app_settings.plan_cycle_start`。首次打开自动播种 `seed.ts`（seedIfEmpty 有 StrictMode 并发守卫）。**改 SEED_ITEMS 后必须把 `SEED_VERSION` +1**：已播种设备会在页顶看到黄色「计划模板有更新」横幅，点「一键同步」触发 `resetToSeed`（清自定义条目和勾，版本号存 `app_settings.plan_seed_version`）。AI 线从"AI 是什么"开始（吴恩达 AI for Everyone 中字→3B1B→李宏毅生成式AI导论→Prompt→RAG/Agent→Evals），英语：摸底 A2（小学摸底 19/20，基础词/拼写/简单句扎实，真正缺的是语法系统和中级词汇；敢开口是亮点）。主线教材=新概念英语第一册（主教材=刘羽Leo 199集含系统语法 BV1xa411J7jJ、纯动画备用 BV1MT4y1o7Cv、影子跟读 BV1PJ4m1M7a3），前约24课可加速、第25课起放慢；单词用「不背单词」PEP词库（已背完一年级+二上，二下起，~10词/天起步、时间盒20min、复习优先）；新东方四级词汇暂缓到 11 月；《查莉》降为中字磨耳朵素材；12/27 里程碑=无字幕听懂 50-60%。**英语用「固定流程+进度指针」而非日历式排课**：每天流程一样，学完一课才进下一课，进度由 Rosie 自己推进（她是复健期学习者，强调不赶日期、重连续性）。晨间英语块拆成 4 个子条目（复习/学新课/影子跟读站着做/不背单词），段间安排起身 5 分钟微休息（护腰+专注，她有腰突）。运动规则：生理期不安排腹部相关（卷腹/侧桥/平板类训练，以及仙人揉腹这类腹部按压）。已做成**经期开关**：study-plan 页头「🩸经期模式」按钮，状态存 `app_settings.plan_period_on`；plan_items 带 `period_action`('skip'隐藏/'swap'替换)+`period_title`+`period_detail`，UI 用 `applyPeriod()` 变换（迁移 v6）。种子里揉腹=skip，腰稳/芭杆/心肺=swap 成经期安全版。新增经期敏感条目时给它设 period_action。阅读书单原则：历史类只收史实可靠的（学术著作或明确标注虚构的史实扩写），回避被史学界指出个人偏颇的通俗史（如《明朝那些事儿》——Rosie 要求等自己历史体系完善后再读）。
- **补剂 `supplement`**：补剂时间表硬编码在 `SCHEDULE`（1=周一..7=周日，改补剂就改它；维D 5000IU 周一一次）。Card 显示今日早/午/晚，Page 有三段：整周补剂表 + **三餐推荐**（减脂向静态内容 `MEALS`）+ **奶茶打卡**（DB 表 `treat_log`，迁移 v7，一杯一条，`data.ts` 里 logTreat/undoTreatToday/treatStats，显示今天/本月杯数）。**接了 study-plan 的经期开关**：`getPeriodOn()` 为真时用 `PERIOD_SCHEDULE`（停鱼油等、只留小红镁——鱼油有抗凝作用经期避开）。即🩸开关同时管运动避腹 + 补剂经期版。
- **学习记录 `study-log`**：科目 + 学习时长/笔记记录。
- **小表格 `mini-table`**：自定义列的轻量表格，是"随手建表"的基础。

## 部署

- **GitHub**：github.com/BingBing908/life-dashboard（master 分支，公开仓库）
- **网页版**：推送 master 后 GitHub Actions 自动部署到 https://bingbing908.github.io/life-dashboard/（配置 `.github/workflows/deploy-pages.yml`，构建带 `GHPAGES=1` 让 vite base 走 `/life-dashboard/`）
- 网页版数据存各浏览器本地，与桌面端、与其他设备**不互通**（待云同步打通）

## 常用命令

```bash
npm run dev          # 纯浏览器预览（网页开发/无 Rust 环境时用这个，端口 1420）
npm run tauri dev    # 桌面应用开发模式（需要 Rust + VS Build Tools）
npm run build        # 类型检查 + 前端构建（提交前跑一遍）
```

## 路线图

- [x] 核心模块 v1（2026-07）
- [x] 待办改版：四象限筛选 + 今天开关 + 就地编辑 + 每周复盘（2026-07-19）
- [x] UI：蓝白配色 + 幼圆字体（2026-07-19）
- [x] 移除计划表模块（2026-07-19，改用 iPad 规划）
- [x] 学练计划模块：五线周计划 + 每日打卡 + 4 周递进 + 视频跟练链接（2026-07-19）
- [ ] 英语摸底测试（词汇/语法/阅读快测 + EF SET + 口语对话评估），测完定教材更新英语线内容
- [ ] **Supabase 云端数据同步**（下一个大功能：所有设备共享同一份数据，需要 Rosie 注册 Supabase）
- [ ] 仪表盘卡片拖拽排布 + 布局持久化
- [ ] 打卡月度热力图、学习番茄钟
- [ ] 进一步 UI 美化（Rosie：先功能后外观）

## 工作习惯

- **本文档随代码同步更新**：改了 `src/` 或 `src-tauri/` 就要把改动反映到本文档（模块现状/路线图/踩坑），和代码一起提交。由 `.claude/settings.json` 的 Stop hook 自动把关：每轮结束时若发现代码提交比 CLAUDE.md 新，会提醒补文档再收尾（该配置已提交进仓库，各电脑通用）。
- 完成一块有意义的改动就提交并推送（Rosie 多台电脑切换，靠 GitHub 同步代码）
- 改动后习惯用浏览器预览（`npm run dev` + 打开 localhost:1420）验证真实交互再提交
- Rosie 的本机工具链都在 `D:\Software\DevTools`（Node/Rust/VS Build Tools/gh），新开终端可能要刷新 PATH：
  `$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")`
- 本地目录名仍是 `PortWritingTool`（GitHub 仓库名是 `life-dashboard`），不影响使用
