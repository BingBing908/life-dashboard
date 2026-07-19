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
  - ⚠️ **改表结构必须四处同步**：`lib.rs` 加新 Migration + `schema.ts` 的 `SCHEMA_SQL`（新库建表）+ `schema.ts` 的 `BROWSER_MIGRATIONS`（旧浏览器库补列，幂等 ALTER）+ `supabase/schema.sql`（云端 Postgres 加列，Rosie 到 Supabase SQL Editor 跑）。新增的表还要加进 `src/lib/sync.ts` 的 `TABLES`
  - SQL 占位符用 `$1..$n`；浏览器层转成编号 `?N`（不是裸 `?`，因为同一参数可能复用，如软删除 `deleted_at=$1, updated_at=$1`）

## 架构约定（重要）

- **一切功能皆模块**。每个模块 = `manifest`（id/名称/图标/卡片尺寸）+ `Card`（仪表盘摘要卡）+ `Page`（完整页面），接口在 `src/modules/types.ts`
- 新模块在 `src/modules/<名字>/` 下自包含（index.tsx + data.ts），在 `src/modules/registry.ts` 注册一行即上架
- **不要**把功能硬编码进仪表盘壳子（`src/App.tsx`、`src/components/dashboard/`）
- 所有业务表带同步预留字段：`id`(UUID)、`created_at`、`updated_at`、`device_id`、`deleted_at`（软删除，查询过滤 `deleted_at IS NULL`）
- 通用组件/工具：`src/components/EditableText.tsx`（点文字就地编辑）；`src/lib/openLink.ts`（Tauri 系统浏览器 / 网页新标签，全应用共用，别再各写一份）；日期用 `src/lib/dates.ts`、周几用 study-plan/data 的 `dayNumOf`（唯一实现，别在模块里重写）。
- **路由**：`App.tsx` 用 **hash 路由**（`#/<module-id>`，`parseHash()`），刷新停在当前页、不回仪表盘；GitHub Pages 无需服务端配置、Tauri 单页也通用。`setView` 改 `location.hash`，监听 `hashchange` 支持前进/后退。模块级路由（子 tab 如学练计划今日/一周暂不进 URL）。

## 模块现状

注册在 `registry.ts` 的有 5 个：`study-plan`（学练计划，首位）、`todo`（待办）、`supplement`（饮食）、`study-log`（学习记录）、`mini-table`（小表格）。

（原独立的「此刻 `focus`」模块已于 2026-07-20 并入学练计划的「今天」页并删除；时间轴逻辑现直接写在 `study-plan/index.tsx`。计划表 planner 更早于 2026-07-19 移除，其 `plan_tasks` 表由迁移 v4 / 浏览器 `DROP TABLE` 清掉。）

- **待办 `todo`**：单一列表 + 五个筛选框（四象限 iu/in/nu/nn + 今天，可叠加筛选）。筛选框含「全部」（清空筛选看全部）。今日视图下方镜像显示**今天的学练计划**（活读取 study-plan 今日条目，虚线框、可勾选写回 plan_checks，不复制记录）——即学练计划自动同步进待办今天；反向"手动加的今天待办→此刻工作"已由 focus 工作域实现（同一份 todo 数据）。每条待办有「今天」开关（点击设/清 `due_date=今天`）和象限彩签，标题可点击就地改。右侧窄栏嵌入打卡。含**每周复盘**（`WeeklyReview.tsx`）：周一~周五完成情况，周五 16:00 起到周末页顶出现横幅，平时点「本周复盘」可看。
- **打卡 `habit-checkin`**：`HabitPanel` 组件（有 `compact` 窄栏模式，被待办页右栏复用），**未单独注册**到 registry。习惯名可就地改。habits 表带 `days`('*' 或 '1,2,3,4,5')+`sort_order`（迁移 v10），`seedHabitsIfEmpty` 首次写入预置清单：工作日=喝水×2/工作站立×4/眼保健操×2/肩颈拉伸/午休，周末=打扫卫生/搓澡；面板按今天星期 `habitOnDay` 过滤只显示当天该打的。**添加习惯时可选重复星期**（一~日七个小方块，全选=每天=`'*'`，否则存 `'1,5,6,7'` 这类）；`daysLabel()` 把 days 转人话，每行末尾显示 days 徽标。若新建的习惯今天不该打卡，表单下会提示「已添加…每周X，今天不显示」免得以为没保存。（"几周一循环"隔周频率暂未做，当前都是每周重复；真要隔周再加 week_interval 列。）
- **学练计划 `study-plan`**：六线周计划（养生/运动/英语/HCIP/AI方向/阅读），按 Rosie 作息表带时间段。**今日视图=时间轴布局（原「此刻」并入，2026-07-20）**：左侧连线时间轴列六个领域（养生6:10/英语7:30/工作9:20/学习19:00/运动19:40/阅读21:00，`DOMAINS` 各带 start 分钟数+颜色，节点间距 gap-9），按当前时间自动定位（`autoDomainKey`：最后一个 start≤now）、红虚线标"现在"，点领域手动切、"← 回到此刻"复位。右侧是该领域的**大卡片**（`ThreeRowCard`）：①勾选+标题+打开按钮 ②详细解释(detail) ③网址 ④"我做了什么"笔记。笔记门控同 focus：英语/学习/阅读/工作**必填才能勾**（`noteRequired`），养生/运动选填。数据源：养生/英语/学习/运动/阅读=对应 track 的 plan 条目（走 plan_checks/plan_notes）；**工作=todo 里 due_date≤今天的项**（toggleTodo 打勾、复用 plan_notes 存笔记）。经期开关（periodOn）与今日视图共用同一 state，切换即时生效。**「今天没勾＝没完成」**是默认语义（打卡按日期存 plan_checks，过了今天不再补）；**唯一例外＝睡前拉伸**：昨天该做却没勾的，今早今日页顶会出现青色「补勾昨天」横幅（`graceItems` 按标题含"睡前拉伸"+昨天该做+昨天未打勾筛出，点按钮 `toggleCheck(id, 昨天)`），因为它常在临睡/过零点才做。要给别的条目也开次日宽限，就扩展 graceItems 的标题判断。八段锦武当版（一三五日）与国局版+足弓（二四六）隔天交替。晚间运动周主题用 Rosie 收藏夹里的欧阳春晓/C戈跟练（一=瘦斜方肌，二=芭杆手臂薄背，三=太极，四=出门散步1小时[周中出门，不出门则室内无跑跳有氧]，五=骨盆稳定，六=出门散步1小时[周末第2次出门]，日=泡沫轴恢复[周日下午搓澡+休闲不出门]）。每周≥2次出门（周四+周六）走满1小时。表 `plan_items`（days: `'*'`=每天或 `'1,3,5'`，1=周一）+ `plan_checks`（每日打卡，UNIQUE(item_id,date)），迁移 v5。**今日/一周/路线**三个视图：今日可勾选、条目带跟练视频链接（Tauri 用 plugin-opener 开系统浏览器，网页开新标签）；路线页渲染 `seed.ts` 里的 `SEMESTER_PLAN`（2026 下半年 6 个月计划：每月体重目标+四线目标+每周焦点，验收日 12/27，总目标见 `SEMESTER_TARGET`——体重 ≤58 达标/56.5 优秀，55 顺延 2027Q1，50 不设）。4 周递进周期（适应/完整/加量/减载），起点存 `app_settings.plan_cycle_start`。首次打开自动播种 `seed.ts`（seedIfEmpty 有 StrictMode 并发守卫）。**改 SEED_ITEMS 后必须把 `SEED_VERSION` +1**：已播种设备会在页顶看到黄色「计划模板有更新」横幅，点「一键同步」触发 `resetToSeed`（清自定义条目和勾，版本号存 `app_settings.plan_seed_version`）。**学习线优先级（2026-07-20 重排）：AI 主线、华为认证副线**——周三晚 19:00+周六下午 14:00-16:00=华为认证(冲 HCIE，从 HCIA→HCIP 推进，周六下午做 eNSP 实验)；周一二四五晚=AI 刷课；周六日上午 09:20-12:00=AI 项目(NOC Sentinel 补 evals+数据、life-dashboard 加 AI 功能，完善后写进简历)。AI 课路线从"AI 是什么"开始（吴恩达 AI for Everyone 中字→3B1B→李宏毅生成式AI导论→Prompt→RAG/Agent→Evals）。英语：摸底 A2（小学摸底 19/20，基础词/拼写/简单句扎实，真正缺的是语法系统和中级词汇；敢开口是亮点）。主线教材=新概念英语第一册（主教材=刘羽Leo 199集含系统语法 BV1xa411J7jJ、纯动画备用 BV1MT4y1o7Cv、影子跟读 BV1PJ4m1M7a3），前约24课可加速、第25课起放慢；单词用「不背单词」PEP词库（已背完一年级+二上，二下起，~10词/天起步、时间盒20min、复习优先）；新东方四级词汇暂缓到 11 月；《查莉》降为中字磨耳朵素材；12/27 里程碑=无字幕听懂 50-60%。**英语用「固定流程+进度指针」而非日历式排课**：每天流程一样，学完一课才进下一课，进度由 Rosie 自己推进（她是复健期学习者，强调不赶日期、重连续性）。晨间英语块（07:30-09:10）：①复习10′ ②学新课55′（Leo课，新概念奇数课=新课文≈35′视频、偶数课=练习留次日复习，一天不必啃完整单元）③朗读+跟读今天课文25′（跟课文自身音频，弃用之前那个过短的影子跟读视频）。④不背单词 PEP 移出晨间→通勤/到公司后背（时间自由）。段间起身5分钟（护腰）。**英语条目带每日进度笔记**：`plan_notes` 表（迁移 v9，UNIQUE(item_id,date)），英语/学习(cert+ai)/阅读条目在今日视图下方有输入框写进度（英语"刷完001"、学习"看了哪个视频"、阅读"看到哪本书哪里"），onChange 即时存库；这几个 track **没写笔记不给打勾**（canCheck 门控，needsNote=english/cert/ai/reading）。养生/运动不门控。运动规则：生理期不安排腹部相关（卷腹/侧桥/平板类训练，以及仙人揉腹这类腹部按压）。已做成**经期开关**：study-plan 页头「🩸经期模式」按钮，状态存 `app_settings.plan_period_on`；plan_items 带 `period_action`('skip'隐藏/'swap'替换)+`period_title`+`period_detail`，UI 用 `applyPeriod()` 变换（迁移 v6）。种子里揉腹=skip，腰稳/芭杆/心肺=swap 成经期安全版。新增经期敏感条目时给它设 period_action。阅读书单原则：历史类只收史实可靠的（学术著作或明确标注虚构的史实扩写），回避被史学界指出个人偏颇的通俗史（如《明朝那些事儿》——Rosie 要求等自己历史体系完善后再读）。
- **饮食 `supplement`**（模块 id 仍是 supplement，显示名「饮食」）：补剂时间表硬编码在 `SCHEDULE`（1=周一..7=周日，改补剂就改它）。Card 显示今日早/午/晚，Page 有三段：整周补剂表 + **三餐推荐**（静态 `MEALS`，每餐给一个自己做 + 一个减脂外卖）+ **奶茶打卡**（DB 表 `treat_log`，迁移 v7，一杯一条，`data.ts` 里 logTreat/undoTreatToday/treatStats，显示今天/本月杯数）。**接了 study-plan 的经期开关**：`getPeriodOn()` 为真时用 `PERIOD_SCHEDULE`（停鱼油等、只留小红镁——鱼油有抗凝作用经期避开）。即🩸开关同时管运动避腹 + 补剂经期版。**饮品打卡**：`treat_log` 扩展了 subtype(奶茶/果茶/酸奶)/brand/name/sugar/calories（迁移 v8），页面右上角月历按品类给有饮品的日子上色（奶茶红/果茶绿/酸奶紫），「记一杯」表单填品类+品牌+名字+糖度+可选热量。**三餐记录**：`meal_log`（date+meal 唯一，v8），每餐可写"我吃了什么"+热量，`dayCalories()` 汇总当日三餐+饮品热量。⚠️ 热量由 Claude 在对话里算（App 不内嵌模型、不自动估算），用户把数字填进热量栏。
- **学习记录 `study-log`**：科目 + 学习时长/笔记记录。（**待改版**为六大板块，规格见下方「学习记录模块改版规划」，2026-07-20 提出、择日做。）
- **小表格 `mini-table`**：自定义列的轻量表格，是"随手建表"的基础。

## 学习记录模块改版规划（待做，2026-07-20 提出）

把 `study-log`（学习记录）从「科目 + 时长」重做成**六大板块**（Tab 切换）。⚠️ 关键设计约束：英语精读文章/背诵材料/谚语、AI 新闻等**内容由 Claude 在对话里生成或挑选后存进模块**（App 不内嵌模型、不自动抓取），沿用「饮食」热量的同款分工。建议让 Claude 一次预生成一周的量存库，免得她每天都要现开对话。带日期的内容（英语每日料、AI 新闻）按日期存取。所有表沿用同步预留字段。

1. **书籍**：记录在读的书。Rosie 开读时建条目→存开始时间；读完→存完成时间；阅读期间随时可写读后感，读完必写一篇。字段大致：title / start_date / finish_date / status / review（读后感，可多次编辑或追加）。
2. **电影**：看完的电影，只记当日日期（无起止），写观后感。字段：title / watch_date / review。
3. **英语**（工作时间抽 ≤1 小时；与晨间「新概念」块是两段英语，合计偏重，故**已定稿精简**）：
   - 每日一篇**精读文章**（Claude 按当下水平≈A2 挑选、要短），支持**划生词**（存所划的词）；给文章时同时给：精读教程/引导 + 本文值得学习的点 + 值得背诵的句子。**Claude 每周摸排一次她当下英语水平**（据划出的生词、笔记、复述表现），据此调精读难度——这是「不植入 App 内 AI、由 Claude 对话生成内容」的核心好处。
   - **不单独出背诵短文**——直接把精读里「值得背诵的句子」当天的背诵材料，次日早晨复习时间背（一篇吃透，工作时间英语≈40min）。（若哪天想加量，再做单双日轮换精读/背诵。）
   - 每日一句**英语谚语/歇后语**（最轻，保留每天）。
4. **语文**（已定稿）：成语（**配典故**，记故事才记得牢会用）+ 古诗 + **练笔/随笔输出**（每天或隔天写 2–3 句到一小段，Claude 给小主题——输出最提升语文水平）。优先级：练笔 > 成语典故 > 古诗积累。可选：易错字词/病句辨析（碎片时间）。
5. **历史**（已定稿方向）：**先搭骨架后填肉**——常驻一个「朝代时间线/关键节点年表」框架板块；再**每日一张卡**（一个事件或人物，Claude 给学术/教科书级可靠来源简述，不用通俗演义）；配一本靠谱通史慢读（中国史从教科书级通史起步）；中国史先建骨架再填肉，世界史同理、别混着来。延续 Rosie「史观框架未稳前不碰偏颇通俗史」的原则。
6. **AI**（已定稿）：每日 5 篇 Claude 精选高质量 AI 新闻，**每条附一句「对 AI PM 的意义/启发」**（把读新闻变攒产品 sense）；新闻**按类型标注**（模型发布/行业/论文/产品/政策）；外加**每日一个 AI 术语卡**（RAG/Agent/eval/蒸馏…），呼应她转型 AI 产品经理 + 现有 AI 学习路线。

## 云端同步方案（当前优先，2026-07-20 定方向）

目标：跨设备共享同一份数据（家/公司网页/桌面），**不因清浏览器而丢**，撑到 12 月复盘。选型 **Supabase**（Postgres + 免费额度 + 客户端 SDK，静态站点也能用）。

- **需要 Rosie 做的一步**：注册 supabase.com（免费）→ 新建 project → 复制 **Project URL** 和 **anon public key** 给 Claude。anon key **本就是设计成放在前端的公开值**，进仓库/网页都安全——真正的门是数据库的 **RLS（行级安全）策略**，不是藏 key。
- **已落地并建表（2026-07-20）**：Rosie 已在 Supabase 跑 `supabase/schema.sql` 建好 13 张表、验证读写通、云端已清空为干净空库。**首次上线铁律：清空后第一个打开的设备必须是有真实数据的那台**（它当源头推上云），否则空设备的种子会先占位。`src/lib/supabase.ts`（客户端，URL+publishable key，已填 Rosie 的项目 `mqzvjrhfvjjuanjkwfsw`）；`src/lib/sync.ts`（`runSync()`：本地 SQLite/sql.js 仍是工作库，逐表把本地↔云做**全量双向合并**，按 `updated_at` 最后写入胜出、`deleted_at` 当普通字段同步；各表独立 try/catch，未建表/离线只告警不崩）；`App.tsx` 首次进入先同步再渲染（4s 超时兜底，防空库重复播种）、之后聚焦+每 30s 增量同步，拉到新数据用 `key={syncTick}` 强制刷新视图。**Rosie 要做的一次性动作：把 `supabase/schema.sql` 整段粘到 Supabase → SQL Editor 运行**（建 13 张表 + 开 RLS + anon 全权限）。建表后各设备首开会自动把本地数据推上云、别的设备拉下来。⚠️ 改本地表结构时 `supabase/schema.sql` 也要同步加列（第 4 处同步点）。
- 数据源本身**没有**替换（没改各模块的 data.ts / db.ts 读写路径）——sync 是叠加在现有 SQL 数据层之上的旁路，模块代码零改动。
- ⚠️ **已知问题（2026-07-20 待修，见待办 #25）：种子条目重复**。根因：seedIfEmpty / seedHabitsIfEmpty 用随机 UUID，两台设备各自播种同一模板→同名不同 id→云端与本地都翻倍。**根治＝种子改确定性 id**（按 track+title 等稳定内容生成，任意设备种出同一条目 id 相同→upsert 去重）。用户手动录入（打卡/笔记/待办）用随机 id、只创建一次，不受影响。清理：truncate 云 + 设备清本地重播 + 只留一台当源头。
- **隐私档位：已定 A（无登录+公开，2026-07-20 Rosie 拍板）**——anon key + 宽松 RLS，打开网页即见数据、零摩擦。她不介意数据公开；个人小工具、网址无人知，公开写的风险可接受。（备选 B 邮箱登录+每用户 RLS 完全私有，暂不用。）
- **API Key（她最在意）——铁律：个人 API Key 绝不进 GitHub，也不建议「加密后提交」**（公开仓库里的密文可被暴力破解，是坏实践）。正确做法：需要 AI Agent 时，key 在**运行时由她在应用里填入**，只存**她自己浏览器的 localStorage**（每设备填一次、不进仓库/不同步给别人）；或进 Supabase 里**受登录保护的私有行**（选档位 B 时）。更稳可加一个 **serverless 代理**（Supabase Edge Function / Cloudflare Worker）在服务端持 key、前端只调代理——这是要 App 自动调用 AI 时的正解，属二期。

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
- [x] 「此刻」时间轴并入学练计划「今天」页（含详细解释、放大、节点间距拉大）+ 删除独立 focus 模块（2026-07-20）
- [x] 打卡添加时可选重复星期（一~日多选，每周重复）（2026-07-20）
- [x] 页面 hash 路由：刷新停在当前页（`#/<module-id>`）（2026-07-20）
- [ ] **【当前优先】Supabase 云端数据同步**（Rosie 明确排到最前：怕清浏览器丢数据、要 12 月复盘、要跨设备/公司网页直接看到数据）。见下方「云端同步方案」。
- [ ] **学习记录改版：六大板块**（书籍/电影/英语/语文/历史/AI），详见「学习记录模块改版规划」（英语/语文/历史/AI 内容已定稿，2026-07-20）
- [ ] 英语摸底测试（词汇/语法/阅读快测 + EF SET + 口语对话评估），测完定教材更新英语线内容
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
