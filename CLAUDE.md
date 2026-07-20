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
  - Tauri 内 → tauri-plugin-sql，本地文件 `portwritingtool.db`，迁移在 `src-tauri/src/lib.rs`（`migrations()`，目前到 **v12**）
  - 纯浏览器 → sql.js (WASM) + localStorage（key `pwt-sqljs-db`），建表 SQL 在 `src/lib/schema.ts`
  - ⚠️ **改表结构必须四处同步**：`lib.rs` 加新 Migration + `schema.ts` 的 `SCHEMA_SQL`（新库建表）+ `schema.ts` 的 `BROWSER_MIGRATIONS`（旧浏览器库补列，幂等 ALTER）+ `supabase/schema.sql`（云端 Postgres 加列，Rosie 到 Supabase SQL Editor 跑）。新增的表还要加进 `src/lib/sync.ts` 的 `TABLES`
  - SQL 占位符用 `$1..$n`；浏览器层转成编号 `?N`（不是裸 `?`，因为同一参数可能复用，如软删除 `deleted_at=$1, updated_at=$1`）

## 架构约定（重要）

- **一切功能皆模块**。每个模块 = `manifest`（id/名称/图标/卡片尺寸）+ `Card`（仪表盘摘要卡）+ `Page`（完整页面），接口在 `src/modules/types.ts`
- 新模块在 `src/modules/<名字>/` 下自包含（index.tsx + data.ts），在 `src/modules/registry.ts` 注册一行即上架
- ⚠️ **列表/卡片组件（尤其含 `<input>` 的）必须定义在模块顶层，不能嵌套在页面组件函数体内**——否则父组件每次 setState 重渲染都会给嵌套组件新的函数身份→React 卸载重挂载→输入框失焦（"只能打一个字"）。数据用 props 传入。踩过：study-plan 的 `ItemRow`/`ThreeRowCard` 曾嵌套在 Page 内，笔记输入框每敲一字就失焦，2026-07-20 提到顶层修复。
- **不要**把功能硬编码进仪表盘壳子（`src/App.tsx`、`src/components/dashboard/`）。（唯一例外：**全局经期开关**放在 `DashboardShell` 头部——它是跨模块的全局设置而非某功能模块，读写 `app_settings.plan_period_on`）
- 所有业务表带同步预留字段：`id`(UUID)、`created_at`、`updated_at`、`device_id`、`deleted_at`（软删除，查询过滤 `deleted_at IS NULL`）
- 通用组件/工具：`src/components/EditableText.tsx`（点文字就地编辑）；`src/components/DoneToggle.tsx`（计划项**三态**开关两按钮【已完成】【未完成】，替代方框勾：pending 两键都不亮／点【已完成】=done绿／点【未完成】=skip琥珀「今天做不了」／再点亮着的键撤销回 pending；可选 canComplete 门控【已完成】。**按钮统一放在每行/卡片最前**（今日卡片、一周列表、待办页镜像、待办本体条目四处一致）。待办本体条目也用它（含已完成区），待办每条下方带**选填**「我具体做了什么」输入，存 `plan_notes`（item_id=todo.id，与今日「工作」卡片共用同一份笔记）；`src/lib/openLink.ts`（Tauri 系统浏览器 / 网页新标签，全应用共用，别再各写一份）；日期用 `src/lib/dates.ts`、周几用 study-plan/data 的 `dayNumOf`（唯一实现，别在模块里重写）。
- **页面宽度约定**（Rosie 反馈：别老做很窄很居中、离边界太远）：模块 Page 统一用 `mx-auto max-w-6xl p-6`（跟学练计划一致），**不要用 max-w-3xl 这种窄容器**；内容要把宽度铺开、方框/卡片按合适大小放大，别缩成小块挤在中间。踩过：学习记录初版用 max-w-3xl，宽屏上挤中间一小条、方框过小，2026-07-20 改 max-w-6xl + 放大方框。
- **路由**：`App.tsx` 用 **hash 路由**（`#/<module-id>`，`parseHash()`），刷新停在当前页、不回仪表盘；GitHub Pages 无需服务端配置、Tauri 单页也通用。`setView` 改 `location.hash`，监听 `hashchange` 支持前进/后退。模块级路由（子 tab 如学练计划今日/一周暂不进 URL）。

## 模块现状

注册在 `registry.ts` 的有 5 个：`study-plan`（学练计划，首位）、`todo`（待办）、`supplement`（饮食）、`study-log`（学习记录）、`mini-table`（小表格）。

（原独立的「此刻 `focus`」模块已于 2026-07-20 并入学练计划的「今天」页并删除；时间轴逻辑现直接写在 `study-plan/index.tsx`。计划表 planner 更早于 2026-07-19 移除，其 `plan_tasks` 表由迁移 v4 / 浏览器 `DROP TABLE` 清掉。）

- **待办 `todo`**：单一列表 + 五个筛选框（四象限 iu/in/nu/nn + 今天，可叠加筛选）。筛选框含「全部」（清空筛选看全部）。**筛选框与添加框联动**（2026-07-20）：点某象限框→添加表单默认象限=该象限；点「今天」框→添加默认勾今天。今日视图下方镜像显示**今天的学练计划**（活读取 study-plan 今日条目，虚线框、可勾选写回 plan_checks，不复制记录；**可折叠、默认收起**——`planOpen`，标题带条数，免得长列表挤掉待办；镜像里**不显示明细时间**，时间只在学练计划页留；待办条目框已放大）——即学练计划自动同步进待办今天；反向"手动加的今天待办→此刻工作"已由 focus 工作域实现（同一份 todo 数据）。每条待办有「今天」开关（点击设/清 `due_date=今天`）和象限彩签，标题可点击就地改。右侧窄栏嵌入打卡。含**每周复盘**（`WeeklyReview.tsx`）：周一~周五完成情况，周五 16:00 起到周末页顶出现横幅，平时点「本周复盘」可看。
- **打卡 `habit-checkin`**：`HabitPanel` 组件（有 `compact` 窄栏模式 + `weekly` 周表格模式，被待办页右栏复用；**待办页用 `compact weekly`**，右栏加宽到 380px），**未单独注册**到 registry。**周表格（2026-07-20，待办在左/打卡在右版式）**：行=全部习惯、列=本周一~日（`mondayOf`+7 天，表头今天列高亮），格子按 `habitOnDay` 决定是否可打（不排的天显示「·」）、`habit_checkins` 按(habit,date)读写可补卡、未来未打卡不可点、今天列描边高亮；打卡本身仍是方框式点按（快速多点），非计划的三态。习惯名可就地改。habits 表带 `days`('*' 或 '1,2,3,4,5')+`sort_order`（迁移 v10），`seedHabitsIfEmpty` 首次写入预置清单：工作日=喝水×2/工作站立×4/眼保健操×2/肩颈拉伸/午休，周日=打扫卫生（搓澡已由 Rosie 删除、2026-07-20 从种子移除；打扫卫生同日改为仅周日）；面板按今天星期 `habitOnDay` 过滤只显示当天该打的。**添加习惯时可选重复星期**（一~日七个小方块，全选=每天=`'*'`，否则存 `'1,5,6,7'` 这类；另有**每天/工作日/周末快捷预设**`DAY_PRESETS`，添加表单和「改重复日」编辑器都有）；`daysLabel()` 把 days 转人话，每行末尾显示 days 徽标。若新建的习惯今天不该打卡，表单下会提示「已添加…每周X，今天不显示」免得以为没保存。（"几周一循环"隔周频率暂未做，当前都是每周重复；真要隔周再加 week_interval 列。）
- **学练计划 `study-plan`**：六线周计划（养生/运动/英语/HCIP/AI方向/阅读），按 Rosie 作息表带时间段。**今日视图=时间轴布局（原「此刻」并入，2026-07-20）**：左侧连线时间轴列六个领域（养生6:10/英语7:30/工作9:20/学习19:00/运动19:40/阅读21:00/**睡前21:40**，`DOMAINS` 各带 start 分钟数+颜色，节点间距 gap-14。**养生按时间拆分**（2026-07-20）：`Domain` 带 `timeMin/timeMax`，养生节点只收上午条目（timeMax 720），新增**睡前节点**收 18:00 后的 wellness（泡脚21:00/睡前拉伸21:40，timeMin 1080），`slotStartMin()` 解析 time_slot 起始分钟），按当前时间自动定位（`autoDomainKey`：最后一个 start≤now）、红虚线标"现在"，点领域手动切、"← 回到此刻"复位。右侧是该领域的**大卡片**（`ThreeRowCard`）：①该项**明细时间**(time_slot 徽标)+标题+打开按钮+**【已完成】【未完成】两按钮**(DoneToggle) ②详细解释(detail) ③网址 ④"我做了什么"笔记。**打勾改成三态两按钮**（2026-07-20）：今日卡片、一周列表(ItemRow)、待办页今日计划镜像三处的方框勾都换成 DoneToggle；**三态＝待做/已完成/今天做不了(skip)**，存在 `plan_checks.status`('done'/'skip'，NULL 视作 done；迁移 **v11**，四处同步：lib.rs+schema.ts SCHEMA_SQL+BROWSER_MIGRATIONS+supabase/schema.sql，Rosie 需到 Supabase 跑 `alter table public.plan_checks add column if not exists status text;`)。数据层：`listCheckStatus`(item→status map)、`setCheckStatus(id,date,status|null)`；`listChecks` 仍只返回 done 集（skip 不计入完成/宽限）。UI：**待做排上面、已决定(done/skip)沉到下方**（`pendingFirst`/镜像 sort），让上方只剩要做的；今日卡片额外显示每项明细时间（原来只有左侧时间轴的领域总段时间）。工作(todo)源无 skip，未完成键对其为空操作；**工作域已完成的 todo 不再消失、沉到该域最下**（2026-07-20，`todoCards` 改为含 done 并按完成排序，与待办页一致）。笔记门控同 focus：英语/学习/阅读**必填才能勾**（`noteRequired`），养生/运动/**工作**选填（工作 2026-07-20 改非必填）。数据源：养生/英语/学习/运动/阅读=对应 track 的 plan 条目（走 plan_checks/plan_notes）；**工作=todo 里 due_date≤今天的项**（toggleTodo 打勾、复用 plan_notes 存笔记）。经期开关（periodOn）与今日视图共用同一 state，切换即时生效。**「今天没勾＝没完成」**是默认语义（打卡按日期存 plan_checks，过了今天不再补）；**唯一例外＝睡前拉伸**：昨天该做却没勾的，今早今日页顶会出现青色「补勾昨天」横幅（`graceItems` 按标题含"睡前拉伸"+昨天该做+昨天未打勾筛出，点按钮 `toggleCheck(id, 昨天)`），因为它常在临睡/过零点才做。要给别的条目也开次日宽限，就扩展 graceItems 的标题判断。八段锦武当版（一三五日）与国局版+足弓（二四六）隔天交替。晚间运动周主题用 Rosie 收藏夹里的欧阳春晓/C戈跟练（一=瘦斜方肌，二=芭杆手臂薄背，三=太极，四=出门散步1小时[周中出门，不出门则室内无跑跳有氧]，五=骨盆稳定，六=出门散步1小时[周末第2次出门]，日=泡沫轴恢复[周日下午搓澡+休闲不出门]）。每周≥2次出门（周四+周六）走满1小时。表 `plan_items`（days: `'*'`=每天或 `'1,3,5'`，1=周一）+ `plan_checks`（每日打卡，UNIQUE(item_id,date)），迁移 v5。**今日/一周/路线**三个视图：今日可勾选、条目带跟练视频链接（Tauri 用 plugin-opener 开系统浏览器，网页开新标签）；路线页渲染 `seed.ts` 里的 `SEMESTER_PLAN`（2026 下半年 6 个月计划：每月体重目标+四线目标+每周焦点，验收日 12/27，总目标见 `SEMESTER_TARGET`——体重 ≤58 达标/56.5 优秀，55 顺延 2027Q1，50 不设）。4 周递进周期（适应/完整/加量/减载），起点存 `app_settings.plan_cycle_start`。首次打开自动播种 `seed.ts`（seedIfEmpty 有 StrictMode 并发守卫）。**改 SEED_ITEMS 后必须把 `SEED_VERSION` +1**：已播种设备会在页顶看到黄色「计划模板有更新」横幅，点「一键同步」触发 `resetToSeed`（清自定义条目和勾，版本号存 `app_settings.plan_seed_version`）。**学习线优先级（2026-07-20 重排）：AI 主线、华为认证副线**——周三晚 19:00+周六下午 14:00-16:00=华为认证(冲 HCIE，从 HCIA→HCIP 推进，周六下午做 eNSP 实验)；周一二四五晚=AI 刷课；周六日上午 09:20-12:00=AI 项目(NOC Sentinel 补 evals+数据、life-dashboard 加 AI 功能，完善后写进简历)。AI 课路线从"AI 是什么"开始（吴恩达 AI for Everyone 中字→3B1B→李宏毅生成式AI导论→Prompt→RAG/Agent→Evals）。英语：摸底 A2（小学摸底 19/20，基础词/拼写/简单句扎实，真正缺的是语法系统和中级词汇；敢开口是亮点）。主线教材=新概念英语第一册（主教材=刘羽Leo 199集含系统语法 BV1xa411J7jJ、纯动画备用 BV1MT4y1o7Cv、影子跟读 BV1PJ4m1M7a3），前约24课可加速、第25课起放慢；单词用「不背单词」PEP词库（已背完一年级+二上，二下起，~10词/天起步、时间盒20min、复习优先）；新东方四级词汇暂缓到 11 月；《查莉》降为中字磨耳朵素材；12/27 里程碑=无字幕听懂 50-60%。**英语用「固定流程+进度指针」而非日历式排课**：每天流程一样，学完一课才进下一课，进度由 Rosie 自己推进（她是复健期学习者，强调不赶日期、重连续性）。晨间英语块（07:30-09:10）：①复习10′ ②学新课55′（Leo课，新概念奇数课=新课文≈35′视频、偶数课=练习留次日复习，一天不必啃完整单元）③朗读+跟读今天课文25′（跟课文自身音频，弃用之前那个过短的影子跟读视频）。④不背单词 PEP 移出晨间→通勤/到公司后背（时间自由）。段间起身5分钟（护腰）。**英语条目带每日进度笔记**：`plan_notes` 表（迁移 v9，UNIQUE(item_id,date)），英语/学习(cert+ai)/阅读条目在今日视图下方有输入框写进度（英语"刷完001"、学习"看了哪个视频"、阅读"看到哪本书哪里"），onChange 即时存库；这几个 track **没写笔记不给打勾**（canCheck 门控，needsNote=english/cert/ai/reading）。养生/运动不门控。运动规则：生理期不安排腹部相关（卷腹/侧桥/平板类训练，以及仙人揉腹这类腹部按压）。已做成**经期开关**：**开关按钮 2026-07-20 移到仪表盘（`DashboardShell` 头部，全局唯一入口，其它页不再放按钮）**，study-plan 页头只显示只读状态徽标「🩸经期中·已避开腹部」；状态存 `app_settings.plan_period_on`；plan_items 带 `period_action`('skip'隐藏/'swap'替换)+`period_title`+`period_detail`，UI 用 `applyPeriod()` 变换（迁移 v6）。种子里揉腹=skip，腰稳/芭杆/心肺=swap 成经期安全版。新增经期敏感条目时给它设 period_action。阅读书单原则：历史类只收史实可靠的（学术著作或明确标注虚构的史实扩写），回避被史学界指出个人偏颇的通俗史（如《明朝那些事儿》——Rosie 要求等自己历史体系完善后再读）。
- **饮食 `supplement`**（模块 id 仍是 supplement，显示名「饮食」）：补剂时间表硬编码在 `SCHEDULE`（1=周一..7=周日，改补剂就改它）。Card 显示今日早/午/晚，Page 有三段：**今日补剂**（只显示当天早/午/晚，2026-07-20 从整周表改成仅今天）+ **三餐推荐**（静态 `MEALS`，每餐给一个自己做 + 一个减脂外卖）+ **奶茶打卡**（DB 表 `treat_log`，迁移 v7，一杯一条，`data.ts` 里 logTreat/undoTreatToday/treatStats，显示今天/本月杯数）。**接了经期开关**：`getPeriodOn()` 为真时补剂区直接显示「🩸 经期：无需进食补剂」（2026-07-20；原 `PERIOD_SCHEDULE` 已删，经期停所有保健品）。即🩸开关同时管运动避腹 + 经期停全部补剂。**饮品打卡**：`treat_log` 扩展了 subtype(奶茶/果茶/酸奶)/brand/name/sugar/calories（迁移 v8），页面右上角月历按品类给有饮品的日子上色（奶茶红/果茶绿/酸奶紫），「记一杯」表单填品类+品牌+名字+糖度+可选热量。**三餐记录**：`meal_log`（date+meal 唯一，v8），每餐可写"我吃了什么"+热量，`dayCalories()` 汇总当日三餐+饮品热量。⚠️ 热量由 Claude 在对话里算（App 不内嵌模型、不自动估算），用户把数字填进热量栏。**页面布局（2026-07-20 重排）**：顶部**今日卡路里**面板 + 下方网格（`gridTemplateColumns`，**三餐左纵跨两行 / 补剂右上 / 奶茶右下**，用 `gridColumn/gridRow` 显式定位）。图标 `Pill`→`Utensils`。**卡路里预算**：`BMR` 常量=1420（Mifflin，女 164/68/24 往低估）；每日目标存 `app_settings.cal_target`（默认 1400，`getCalTarget/setCalTarget`，页头数字框可改、跨设备同步）；**晚餐可吃 = 目标 − 早 − 午**（读 meals 的 calories 实时算）；预算条含各餐分段 + **目标标记 + 基代红线**（版本1条+版本4红线合并），目标低于 BMR 时红字警告"当心掉发"；减脂安全区 1420–1550。Rosie：24岁，别信减脂App默认的 1200（低于她基代=掉发区）。
- **学习记录 `study-log`**（**2026-07-20 改版为六大板块 v2**，原「科目+时长」已弃）：**主界面＝六个彩色方框**（田字：英语·语文 / AI·历史 / 书籍·电影），每框左图标+名+条数、**右侧露出内容预览**（学习板块显示最新一条摘要；书籍/电影露封面缩略）；点方框进对应板块、左上"← 学习记录"返回（模块内自管 `board` state，非路由）。数据＝**一张通用表 `study_entries`**（迁移 **v12**：board/kind/entry_date/title/body/meta(JSON)/status + 同步字段；`data.ts` 里 `listAllEntries`(一次取全在组件里分组)/`createEntry/updateEntry/deleteEntry`）。
  - **英语/语文/AI/历史**（`LearningBoard`）：**当天条目展开、历史按日期折叠**（点日期头展开，今天默认开），所有看过的都留记录可翻。内容**由 Claude 更新**（见下"内容注入"）；也有个「加一条」次要入口供手动/测试。展示为主（`EntryDoc` 只读+删）。
  - **书籍**（`BookBoard`→`BookNotebook`）：书架（封面墙，3:4 海报格）→ 点进「本子」：封面 + 开始/读完日 + 在读/读完切换（status，读完写 meta.finish_date）+ **5 星评分**(`Stars`，存 meta.rating)+ **每日进度/随笔**(kind='note' 的子条目，meta.book_id 关联，按天列)+ **读后感**(body，textarea onBlur 存)。
  - **电影**（`MovieBoard`）：海报卡列表，封面 + 5 星 + 观后感(body)。
  - **产品经理**（2026-07-21 加，第 8 板块，`LearningBoard` 型，kinds＝PM概念/产品拆解/练习；board 值 'pm'，灰色）：为 Rosie 转型 AI PM 最高杠杆的一块——PM 概念卡 + AI 产品拆解（5 问框架）+ 用她自己的 life-dashboard/NOC Sentinel 练"像 PM 地讲"。HCIE **不单开板块**（已在学练计划里，且非转型驱动；网络背景作简历差异化）。
  - **语文/历史内容方向**（Rosie 定位＝课外阅读+找回语文输出/文化感）：语文＝古诗每天背一首(从短到长、先她喜欢的词风，做过词风测试再定)＋练笔输出(治"说话没文化")＋成语配典故；历史＝课外阅读式中国古代史故事，**从诸子百家开篇**(她最感兴趣)再按先秦→往后的时间线走，靠谱来源不戏说。
  - **金融**（2026-07-20 加，第 7 板块，`LearningBoard` 型，kinds＝K线基础/基金知识/基金新闻/我的复盘）：**教育性质**——Claude 教怎么看 K 线/日线、怎么读基金新闻、基金入门概念（指数vs主动/定投/费率/风险）。⚠️ **红线：不做个性化投资建议、不荐具体基金、不给买卖时点**（Claude 非持牌顾问；那类是 Rosie 自己或持牌顾问的决定）。board 值 'finance' 走通用表，无需迁移。
  - ⚠️ 书籍/电影板块**按 `kind !== 'note'` 筛**（不是 `kind==='book'/'movie'`）——旧版建的书/电影 `kind` 是空的，用 kind==='book' 会漏掉（踩过：Rosie 旧版加的《她对此感到厌烦》同步下来后不显示）。笔记子条目才是 `kind='note'`。
  - **封面**：Rosie 报书名/片名 → Claude 联网找封面图 URL 写进 meta.cover（`<img>` 直接显示；没有则占位图标 + "封面待补"提示）。
  - **英语精读系统 v2（方案 A，2026-07-20）**：英语板块用专属 `EnglishBoard`（其余学习板块仍 `LearningBoard`）。`精读文章` 条目用 `ReadingCard`：左＝文章正文，下方「▾展开中文翻译」（整段中文，meta.article_cn）+「默写文章」；右＝**竖排单词本**（meta.words=[{en,cn}]）+「默写单词」。**默写**（`WordDictation`/`ArticleDictation`）：单词=乱序(shuffle)、**先英译中→批改→再中译英→批改→完成本遍**；文章=写→批改（按词命中率%+标漏词）；**各留最多 3 遍**（存 meta.wordAtt/artAtt，`slice(-3)`），标签切换对比进步，写 1 遍即完成。批改：中文宽松匹配(cnOk 含子串)、英文规范化全等(enOk)。⚠️ Claude 写精读时 meta 要带 `article_en / article_cn / words[{en,cn}] / notes / recite`（否则单词本/双译/批改没数据）。写内容用 upsert（`Prefer: resolution=merge-duplicates`）避免覆盖她的默写记录（同一天别重写）。
  - ⚠️ **后台同步不 bump 视图**（App.tsx，2026-07-20）：`key={syncTick}` 只在**首次**同步 bump；聚焦/30s 定时同步只推拉数据、不重挂载——否则会打断默写、把用户弹回板块首页。
  - **卡片配图**（2026-07-20）：`EntryDoc` 若 `meta.image` 存在（data URI）则在正文下渲染 `<img>`。用于金融「K线怎么看」嵌了一张自绘的蜡烛图 SVG（**固定颜色 + 白底自包含**，因为 `<img>` 里的 SVG 拿不到页面 CSS 变量，不能用 var()）。Claude 用 curl 把 svg base64 成 `data:image/svg+xml;base64,…` 塞进 meta.image。
  - **AI 新闻长度定稿**（2026-07-20，Rosie 确认）：每条分【发生了什么 / 为什么值得注意 / 对 AI PM 的意义】三段长版（不是一句话摘要）。金融教育性内容配图 + 通俗讲解 + 真实入门课链接。
  - **下划线术语释义**（2026-07-20）：`EntryDoc` 把 body 里的 `[[术语]]` 渲染成**下划线可点**，点开显示 `meta.glossary`（`{术语: 释义}`）里的解释（浮层框）。用于 AI 新闻里给「多模态 / Sol·Terra·Luna / OpenAI / Z.ai / Meta / EU AI Act」等专业词和公司背景做即点即看的扩充。Claude 写内容时在 body 标 `[[词]]`、并把释义放进 meta.glossary。
  - ⚠️ **含输入的卡片组件全部模块顶层**（Landing/LearningBoard/EntryDoc/AddEntryForm/Stars/BookBoard/BookNotebook/MovieBoard/MovieCard/AddTitleForm），textarea 用非受控 defaultValue+onBlur、其余受控 state 在顶层组件内（避免父组件重渲染失焦）。`patchEntry` 用特殊键 `__body`→body 列、`status`→status 列、其余并进 meta。
  - **内容注入（关键）**：英语/AI 等每日内容 Rosie **不自己贴**——她晚上发 Claude"X 学完了换新的"，**Claude 用 publishable key 经 REST 直接写进她的 `study_entries` 云表**（curl 已验证可写，档位 A anon 全权限），她第二天打开 App 同步下来就有。**前提：Rosie 必须先在 Supabase 建 `study_entries` 表**（否则 404、存不了也同步不了）。生词划线、时间线可视化留 v3。
- **小表格 `mini-table`**：自定义列的轻量表格，是"随手建表"的基础。

## 学习记录·每日内容喂养（Claude 每天做的事——换对话/换窗口都照这个走）

学习记录的内容**全部由 Claude 生成后写进 Supabase**（Rosie 不自己贴）。她晚上说「XX 换新的」，Claude 更新云，她次日打开看。**换新对话/新窗口也要能接着走、绝不重复**——铁律：**先读云端已有的，再续着往下生成**。

### 怎么写（curl；publishable key 是公开安全值）
- 表 `study_entries`：`id / board / kind / entry_date(YYYY-MM-DD) / title / body / meta(JSON) / status / sort_order` + 同步字段。
- URL `https://mqzvjrhfvjjuanjkwfsw.supabase.co/rest/v1/study_entries`；Header `apikey:<key>` + `Authorization: Bearer <key>`（key 见 `src/lib/supabase.ts`，公开可用）。
- 写＝POST 一个 JSON 数组，Header 加 `Prefer: resolution=merge-duplicates,return=minimal`（按 id 幂等 upsert，重跑不重复）。
- **id 约定** `<board>-<YYYYMMDD>-<slug/序号>`（如 `chn-20260721-poem1`）；`updated_at` 用当前 ISO（比本地新才会同步下去）。
- body 里 `[[术语]]`→下划线点开释义（释义放 `meta.glossary={术语:释义}`）；`meta.image`＝data URI 图，显示在正文下（SVG 要固定颜色+白底，因 `<img>` 读不到页面 CSS 变量）；书/影封面放 `meta.cover`（豆瓣图有防盗链→下载后 base64 成 data URI，别直接存网址）。
- ⚠️ 开发模式默认不联云（见「云端同步方案」），喂内容**用 curl 直接写生产库**，不靠 dev app。

### 不重复的关键：先读后写（进度＝云里已有的）
生成前先 GET 看该 board 已有啥，续着下一条（别重复已讲过的成语/古诗/人物/概念）：
`curl "…/rest/v1/study_entries?board=eq.chinese&select=kind,title,entry_date&order=entry_date.desc" -H "apikey:…" -H "Authorization: Bearer …"`

### 每个板块的每日内容 + 方向（进度指针）
- **英语 english**（kind：精读文章/谚语）：每天一篇 A2 短精读（80–120 词），meta 必带 `article_en / article_cn(整段翻译) / words[{en,cn}]（约5个生词，含中文释义供默写批改）/ notes(学习点) / recite(背诵句)`，再加一句英语谚语。难度按她水平（≈A2），每周摸排一次再调；晨间另有新概念块，这块保持轻量。
- **语文 chinese**（kind：成语/谚语/古诗/练笔）：每天 **①一个成语（必给意思+出处+例句）②一个谚语/俗语（给意思）③一首古诗背诵**（按词风顺序 **D 边塞 > C 田园 > B 豪放 > E 深情 > F 清新 > A 婉约**，短→长，先在最爱风格里挑、熟了掺别的）**④一个练笔题**（她写、Claude 批改，往"更有画面感/更像人话"改）。历史故事里出现的成语（如韦编三绝）也要补意思。
- **历史 history**（kind：时间线/事件·人物）：课外阅读式中国古代史，**先诸子百家**（孔→孟→老→庄→墨→荀→韩非…每位＝生平+一句话核心思想+一则小故事+对今天/对 PM 的启发），讲完再按 先秦→秦汉→魏晋→隋唐→宋元→明清 时间线推。靠谱来源、不戏说演义。
- **AI ai**（kind：新闻/术语卡）：每天 **5 条真实新闻（须 WebSearch 拿当天的、不编）**，分【发生了什么 / 为什么值得注意 / 对 AI PM 的意义】三段长版 + **1 张术语卡**；专业词/公司名用 `[[ ]]` 标、释义进 meta.glossary。
- **金融 finance**（kind：K线基础/基金知识/基金新闻/我的复盘）：财商课，教 K线/基金原理/读基金新闻，尽量配图（meta.image）。⚠️ **只教知识，不荐具体基金、不给买卖时点、不做个性化投资建议**（Claude 非持牌顾问）。
- **产品经理 pm**（kind：PM概念/产品拆解/练习）：每天一个 PM 概念卡 + 一个 AI 产品拆解（5 问：用户/痛点/体验/赚钱/我会怎么改）+ 用她的 life-dashboard/NOC Sentinel 练"像 PM 地讲"。
- **书籍 book / 电影 movie**：Rosie 自己录入；Claude 只在她报书名/片名时联网找封面写进 `meta.cover`。

## 云端同步方案（当前优先，2026-07-20 定方向）

目标：跨设备共享同一份数据（家/公司网页/桌面），**不因清浏览器而丢**，撑到 12 月复盘。选型 **Supabase**（Postgres + 免费额度 + 客户端 SDK，静态站点也能用）。

- **需要 Rosie 做的一步**：注册 supabase.com（免费）→ 新建 project → 复制 **Project URL** 和 **anon public key** 给 Claude。anon key **本就是设计成放在前端的公开值**，进仓库/网页都安全——真正的门是数据库的 **RLS（行级安全）策略**，不是藏 key。
- **已落地并建表（2026-07-20）**：Rosie 已在 Supabase 跑 `supabase/schema.sql` 建好 13 张表、验证读写通、云端已清空为干净空库。**首次上线铁律：清空后第一个打开的设备必须是有真实数据的那台**（它当源头推上云），否则空设备的种子会先占位。`src/lib/supabase.ts`（客户端，URL+publishable key，已填 Rosie 的项目 `mqzvjrhfvjjuanjkwfsw`）；`src/lib/sync.ts`（`runSync()`：本地 SQLite/sql.js 仍是工作库，逐表把本地↔云做**全量双向合并**，按 `updated_at` 最后写入胜出、`deleted_at` 当普通字段同步；各表独立 try/catch，未建表/离线只告警不崩）；`App.tsx` 首次进入先同步再渲染（4s 超时兜底，防空库重复播种）、之后聚焦+每 30s 增量同步，拉到新数据用 `key={syncTick}` 强制刷新视图。**Rosie 要做的一次性动作：把 `supabase/schema.sql` 整段粘到 Supabase → SQL Editor 运行**（建 13 张表 + 开 RLS + anon 全权限）。建表后各设备首开会自动把本地数据推上云、别的设备拉下来。⚠️ 改本地表结构时 `supabase/schema.sql` 也要同步加列（第 4 处同步点）。
- 数据源本身**没有**替换（没改各模块的 data.ts / db.ts 读写路径）——sync 是叠加在现有 SQL 数据层之上的旁路，模块代码零改动。
- ⚠️ **开发模式默认不联云**（2026-07-20）：`runSync` 开头 `if (import.meta.env.DEV && localStorage 'pwt-sync-on'!=='1') return false;`——防止本地 `npm run dev` 测试数据污染 Rosie 的生产云（之前踩过：测试浏览器把种子重复推上云）。dev 里要联云手动 `localStorage.setItem('pwt-sync-on','1')`；**生产（网页版/桌面版）永远同步**。
- **Claude 可直接读写云**：用 publishable key `curl`/fetch 到 `…supabase.co/rest/v1/<表>`（档位 A anon 全权限）。已用于给学习记录写每日内容、修数据。⚠️ 批量 DELETE/navigate 会被安全分类器拦（改用 Supabase SQL Editor 让 Rosie 跑）；用非 app 页（如 supabase REST 源）跑只读查询避免触发某个开着 app 的标签页同步。
- ✅ **已修（2026-07-20，原待办 #25）：种子条目重复**。根因：seedIfEmpty / seedHabitsIfEmpty 曾用随机 UUID，两台设备各自播种同一模板→同名不同 id→云端与本地都翻倍。**根治已落地＝种子改确定性 id**：`db.ts` 新增 `seedUuid(key)`（4 轮 FNV-1a 拼 128 位→合法 UUID 格式，同 key 任意设备同 id），`seedIfEmpty` 用 `plan_item:track|title|time_slot`、`seedHabitsIfEmpty` 用 `habit:name` 作 key（均已验证 25+12 条唯一不撞）→ 云同步 upsert 去重。用户手动录入（打卡/笔记/待办）仍用随机 `uuid()`、只创建一次，不受影响。**新增/改动种子条目时保证 key（track+title+time_slot / name）唯一即可**。⚠️ 本修复只防**将来**重复；**已存在的旧重复数据需一次性清理**（数据很年轻，推荐直接 nuke 重播）：Supabase SQL Editor `truncate` 相关表 → 各设备清本地（浏览器清 `pwt-sqljs-db` localStorage / 桌面删 `portwritingtool.db`）→ 只让一台设备先打开重新播种（确定性 id）→ 其余设备再打开自动拉取。
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
- [x] 种子确定性 id（修 #25 云同步条目翻倍）：`seedUuid` + 两处种子按内容生成 id（2026-07-20）——⚠️ 旧重复数据待 Rosie 跑一次性清理（见「云端同步方案」#25 条）
- [ ] **【当前优先】Supabase 云端数据同步**（Rosie 明确排到最前：怕清浏览器丢数据、要 12 月复盘、要跨设备/公司网页直接看到数据）。见下方「云端同步方案」。#25 种子重复已修，剩最后一步：Rosie 跑一次性清理旧重复数据。
- [x] **学习记录改版：六大板块 v1**（英语/语文/AI/历史/书籍/电影，通用 `study_entries` 表 + 六 Tab，2026-07-20）；生词划线/时间线可视化留 v2
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
