import type { Track } from "./data";

/** 种子模板版本号：每次修改 SEED_ITEMS 后 +1，已播种的设备会看到"模板有更新"横幅。
 *  ⚠️ v25 起**纯新增**的版本会被 ensureSeedAdditions 静默补齐（不动她改过的条目、不弹横幅）；
 *  **修改了已有条目**的版本升级仍要靠横幅+一键同步（会重置她的改动，别轻易做）。 */
export const SEED_VERSION = 25;

/**
 * 首次使用时的种子计划——按 Rosie 的作息表时间排布。
 * 全部可在页面里改标题/备注、删除、新增。
 */
export const SEED_ITEMS: {
  track: Track;
  days: string;
  time_slot: string;
  title: string;
  detail?: string;
  url?: string;
  /** 经期开关打开时：'skip'=隐藏；'swap'=换成 period_title/period_detail */
  period_action?: "skip" | "swap";
  period_title?: string;
  period_detail?: string;
}[] = [
  // ---------- 早晨 ----------
  {
    track: "wellness",
    days: "*",
    time_slot: "06:10–06:30",
    title: "仙人揉腹",
    url: "https://www.bilibili.com/video/BV1oh4y1d7kb/",
    period_action: "skip",
  },
  {
    track: "wellness",
    days: "*",
    time_slot: "06:30–06:40",
    title: "五脏逼毒",
    url: "https://www.bilibili.com/video/BV1JL41167Bk/",
  },
  {
    track: "wellness",
    days: "1,3,5,7",
    time_slot: "06:50–07:25",
    title: "八段锦（武当版）",
    detail: "与国局版隔天交替；今天不排足弓，多出的时间当早晨缓冲；周日想换国局版也行",
    url: "https://www.bilibili.com/video/BV1ZK411z7wY/",
  },
  {
    track: "wellness",
    days: "2,4,6",
    time_slot: "06:50–07:05",
    title: "八段锦（国家体育总局版）",
    detail: "与武当版隔天交替；练完接足弓训练",
    url: "https://www.bilibili.com/video/BV1jG411c7yo/",
  },
  {
    track: "wellness",
    days: "2,4,6",
    time_slot: "07:05–07:25",
    title: "足弓重建（跟国局八段锦同日）",
    detail: "拯救扁平足 / 优化下肢力线（量小，归养生）",
    url: "https://www.bilibili.com/video/BV1ofKEzjEUd/",
  },
  // ⚠️ 2026-09-01 英语从四条合并成一条（Rosie 给的新作息：07:30 先吃早餐，
  // 07:50–09:40 英语整块 110 分钟，把原来的①复习跟读②学新课③朗读跟读④不背单词全并进来）。
  // 原来分四条是为了「每步都能单独打卡」，但她的反馈是负担太重——一条打一次卡就够。
  // 内部顺序写在 detail 里当流程参考，不再各自成条。中途起身那条规矩保留在 detail。
  {
    track: "english",
    days: "*",
    time_slot: "07:50–09:40",
    title: "英语（新概念整块：复习→新课→朗读→单词）",
    detail: "①复习昨课·出声跟读 ≈10′ ②学新课（刘羽Leo：单词→语法→文章，奇数课=新课文、偶数课=练习留次日）≈55′ ⏸中途起身5分钟 ③朗读+跟读今天课文（站着做）≈25′ ④不背单词 PEP ≈20′（没背完的挪到通勤/到公司后）。进度自己走、学完一课才进下一课，不赶日期。纯动画备用 BV1MT4y1o7Cv",
    url: "https://www.bilibili.com/video/BV1xa411J7jJ/",
  },
  // ---------- 周末上午：AI（主线）。2026-09-01 新作息：英语 09:40 结束，
  // 周末不用通勤，AI 直接从 09:40 接上 ----------
  {
    track: "ai",
    days: "6,7",
    time_slot: "09:40–12:00",
    title: "AI 项目完善（周末大块·主线）",
    detail: "给 NOC Sentinel 补评测(evals)+使用数据、给 life-dashboard 加 AI 功能，查漏补缺做完善；每完善一块就想「怎么写进简历」——量化影响+evals+迭代故事。前期还没上手时，先跟吴恩达《AI for Everyone》把概念看懂",
    url: "https://www.bilibili.com/video/BV1yC4y127uj/",
  },
  // 周六下午整块五小时（原来只排了 14:00–16:00 两小时，2026-09-01 按她的新作息
  // 扩成 13:00–18:00——这是每周唯一一段能啃硬东西的长时间，别切碎）。
  // 周日下午刻意不排学习：打扫(13:00-15:00)+搓澡(15:00-17:00)+护肤(17:00-18:00)，
  // 那是恢复日的下午，写在日程视图的作息骨架里。
  {
    track: "ai",
    days: "6",
    time_slot: "13:00–18:00",
    title: "AI 学习·周六下午大块（原华为认证时段）",
    detail: "整块五小时，啃需要连贯注意力的内容：一整章课程、一篇 RAG/Agent 技术文、或把本周项目翻译题写成正式的一页纸。跟晚间碎片刷课分工——晚上看短段落，这里啃硬的。⚠️ 中途每小时起身 5 分钟（护腰），别连坐五小时。（2026-09-01 从「华为认证·eNSP 实验 14:00–16:00」换过来并扩到整个下午）",
    url: "https://www.bilibili.com/video/BV1yC4y127uj/",
  },
  // ---------- 晚间学习：90 分钟拆两段，中间夹运动（2026-09-01 定，见文件头说明）----------
  {
    track: "ai",
    days: "1,2,3,4,5",
    time_slot: "19:00–19:45",
    title: "AI 学习① 看课（45 分钟）",
    detail: "沿路线看课：吴恩达 AI for Everyone→李宏毅生成式AI导论→Prompt→RAG/Agent。边看边记「AI 名词手册」。⚠️ 这段完就去做腰椎稳定+运动——**运动本身就是两段学习中间的那次起身**，护腰不用另外安排，也别把 90 分钟连着坐完",
    url: "https://www.bilibili.com/video/BV1yC4y127uj/",
  },
  {
    track: "ai",
    days: "1,2,3,4,5",
    time_slot: "20:25–21:10",
    title: "AI 学习② 动手（45 分钟）",
    detail: "运动完缓 5 分钟再开始。跟①分工：①是输入（看课），②是输出——把刚学的动手试一遍，或推进 NOC Sentinel / life-dashboard 里的一小块。⚠️ 学 AI 最容易的失败方式是只看不做，这段就是为了每天都有产出。⚠️ 散步日（周四/周六）出门 1 小时，这段顺延到回来后，写不完就写一半，别为了赶时间不出门",
  },
  {
    track: "english",
    days: "6",
    time_slot: "19:00–19:45",
    title: "英语·本周复盘",
  },
  // ---------- 晚间运动 ----------
  {
    track: "sport",
    // ⚠️ 不是每天：**散步日（四/六）不排它**（2026-07-30 Rosie：「只要是散步，那么运动页就只允许放散步，
    // 不要别的」）。它本来的角色是视频跟练前的「开场」，而散步日没有视频跟练、出门 1 小时本身就是全部内容，
    // 再垫 10 分钟腰椎稳定只会让人出不了门。周日虽是恢复日但仍在家做，保留。
    days: "1,2,3,5,7",
    time_slot: "19:45–19:55",
    title: "腰椎稳定 10 分钟（每晚开场）",
    detail: "鸟狗式 / 侧桥 / 改良卷腹；⚠️ 出现放射性疼痛立即停。（视频待换成 Rosie 收藏的腰椎稳定跟练）",
    // url 待定：原 BV11f421Q7ZU 非 Rosie 收藏，已移除；Rosie 提供她收藏的链接后再填
    period_action: "swap",
    period_title: "腰椎稳定·经期版 10 分钟",
    period_detail: "猫牛式 + 臀桥 + 髋部轻拉伸（不做任何卷腹/侧桥/平板）；⚠️ 出现放射性疼痛立即停",
  },
  {
    track: "sport",
    days: "1",
    time_slot: "19:55–20:20",
    title: "C戈·瘦斜方肌 20 分钟（针对斜方肌肥大）",
    detail: "正对你的斜方肌肥大；圆肩另配 C戈肩带综合矫正 BV15T411j7bs",
    url: "https://www.bilibili.com/video/BV1Qv411u7aF/",
  },
  {
    track: "sport",
    days: "2",
    time_slot: "19:55–20:20",
    title: "欧阳春晓·芭杆练手臂 x 薄背 20 分钟（全程站立）",
    url: "https://www.bilibili.com/video/BV11Autz4EoV/",
    period_action: "swap",
    period_detail: "🩸 经期：跳过视频里的卷腹/平板段落，其余照做",
  },
  {
    track: "sport",
    days: "3",
    time_slot: "19:55–20:20",
    title: "24 式太极·邱慧芳教学（分段学）",
    detail: "跟你收藏的邱慧芳教学版，一次学一两式",
    url: "https://www.bilibili.com/video/BV1iE411c7Ni/",
  },
  {
    track: "sport",
    days: "4",
    time_slot: "出门时段",
    title: "出门散步 1 小时（周中·心肺日）",
    detail: "本周第1次出门就走满1小时；不出门则在家做欧阳春晓·王心凌15分钟无跑跳有氧 BV1KCamz3EAz",
    url: "https://www.bilibili.com/video/BV1KCamz3EAz/",
  },
  {
    track: "sport",
    days: "5",
    time_slot: "19:55–20:20",
    title: "欧阳春晓·大腿内侧 x 盆底肌 x 骨盆稳定 20 分钟",
    detail: "针对骨盆前倾；膝超伸另配 C戈膝超伸矫正 BV1K7411b7yo",
    url: "https://www.bilibili.com/video/BV1PhHrzfEqN/",
  },
  {
    track: "sport",
    days: "6",
    time_slot: "出门时段",
    title: "出门散步 1 小时（周末·第2次出门）",
    detail: "本周第2次出门就走满1小时、晒太阳；不出门则在家做芭杆臀腿 BV1FczFBcEBQ",
    url: "https://www.bilibili.com/video/BV1FczFBcEBQ/",
  },
  {
    track: "sport",
    days: "7",
    time_slot: "19:55–20:20",
    title: "恢复日·泡沫轴放松（周日下午搓澡+休闲，晚间放松即可）",
    detail: "泡沫轴放松，重点滚斜方肌和小腿；周日安排搓澡+休闲，不再出门运动",
    url: "https://www.bilibili.com/video/BV1pp4y1X7og/",
  },
  // ---------- 睡前 ----------
  {
    track: "wellness",
    days: "1,5,6,7",
    time_slot: "21:10–21:50",
    title: "泡脚",
    detail: "和阅读同时段，边泡边看书；水别太烫、15-20分钟即可；其他晚上想泡随时加",
  },
  {
    track: "reading",
    days: "*",
    time_slot: "21:10–21:50",
    title: "阅读（泡脚时段）",
    detail: "当前：《她对此感到厌烦》；之后：长安的荔枝→秋园→显微镜下的大明→82年生的金智英→万历十五年→始于极限→叫魂→翦商；历史类只收史实可靠的；50 页弃权规则，只记进度不设 KPI",
  },
  {
    track: "wellness",
    days: "*",
    time_slot: "21:50–22:10",
    title: "睡前拉伸",
    detail: "跟练 10-15 分钟；顺便吃当日补剂（小红镁/钙镁锌）",
    url: "https://www.bilibili.com/video/BV1UovWBNENi/",
  },

  // ---------- 作息骨架（v25 新增；2026-09-19 Rosie：骨架也要和计划一样可编辑、走同步） ----------
  // track="frame"：不打卡、不进时间轴/总览统计（listItems 直接滤掉），只有日程页画它。
  // ⚠️ 周六周日晚餐必须合成一条 days:"6,7"——拆成两条的话 track|title|time_slot 完全相同，
  // 确定性 id 撞车，后播的会把先播的覆盖掉。
  { track: "frame", days: "*", time_slot: "06:40–06:50", title: "如厕" },
  { track: "frame", days: "*", time_slot: "07:25–07:30", title: "缓冲" },
  { track: "frame", days: "*", time_slot: "07:30–07:50", title: "早餐" },
  { track: "frame", days: "*", time_slot: "09:40–09:45", title: "缓冲" },
  { track: "frame", days: "1,2,3,4,5", time_slot: "09:45–10:15", title: "通勤上班" },
  { track: "frame", days: "1,2,3,4,5", time_slot: "10:15–12:00", title: "工作" },
  { track: "frame", days: "1,2,3,4,5", time_slot: "12:00–12:30", title: "午餐" },
  { track: "frame", days: "1,2,3,4,5", time_slot: "12:30–13:00", title: "空档" },
  { track: "frame", days: "1,2,3,4,5", time_slot: "13:00–14:00", title: "日日学" },
  { track: "frame", days: "1,2,3,4,5", time_slot: "14:00–17:30", title: "工作" },
  { track: "frame", days: "1,2,3,4,5", time_slot: "17:30–17:50", title: "晚餐" },
  { track: "frame", days: "1,2,3,4,5", time_slot: "17:50–18:10", title: "通勤回家" },
  { track: "frame", days: "1,2,3,4,5", time_slot: "18:10–19:00", title: "空档" },
  { track: "frame", days: "6,7", time_slot: "12:00–13:00", title: "午餐" },
  { track: "frame", days: "7", time_slot: "13:00–15:00", title: "打扫卫生" },
  { track: "frame", days: "7", time_slot: "15:00–17:00", title: "搓澡洗头沐浴" },
  { track: "frame", days: "7", time_slot: "17:00–18:00", title: "全身护肤护发" },
  { track: "frame", days: "6,7", time_slot: "18:00–18:40", title: "晚餐" },
];

// ---------- 半年路线（2026-07-20 → 12-27，共 23 周） ----------

export interface MonthPlan {
  title: string;
  period: string;
  weight: string;
  goals: { sport: string; english: string; cert: string; ai: string };
  weeks: string[];
}

export const SEMESTER_TARGET =
  "2026-12-27 验收总目标：体重 ≤58kg 达标 / ≤56.5kg 优秀（55kg 顺延至 2027 Q1，50kg 不设为目标）· 英语学完新概念一册、开二册，无字幕看《查莉》听懂 50-60%（A2 起步，务实目标）· 【主线】手握 2 个可写进简历的 AI 落地作品（NOC Sentinel 补 evals+数据、life-dashboard 加 AI 功能）+ 简历更新 · ⏸ 华为认证已于 2026-09-01 暂停（Rosie：「浪费时间」），原周三晚 + 周六下午两个时段全部并给 AI；网络背景仍可作简历差异化，想恢复时把 seed.ts 里那两条加回来即可";

/**
 * 上面那段总目标的**短标签版**，给总览「四条线」卡第三行用（一格只放得下几个字）。
 * ⚠️ 刻意跟 `SEMESTER_TARGET` **挨着放**：它俩是同一件事的长短两版，
 * 分家到两个文件早晚会漂移。改一个记得对一眼另一个。
 * 验收日在 `ACCEPTANCE_DATE`，也别再写第二份。
 */
export const ACCEPTANCE_DATE = "2026-12-27";

export const LINE_TARGETS: {
  key: "english" | "pm" | "ai" | "weight";
  name: string;
  target: string;
  /** 这条线已暂停：卡片上灰掉、不报「断了」的警。当前没有暂停的线，机制保留备用 */
  paused?: boolean;
}[] = [
  { key: "english", name: "英语", target: "无字幕听懂 50–60%" },
  // ⚠️ 2026-09-01 由「华为认证（已暂停）」换成 AI PM（Rosie 拍板）。
  // 这条线的数据源跟其他线不同：**不在时间轴里，在日日学的 pm 板块**——
  // 每天一道「项目翻译」题，她交了作业、批改写进 meta.homework 才算这条线动了。
  // 目标日期＝2027 年 3–4 月面试窗口。华为认证的暂停记录在 SEMESTER_TARGET 里，没丢。
  { key: "pm", name: "AI PM", target: "3 月面试 · 把项目讲成 PM 的故事" },
  { key: "ai", name: "AI", target: "两个项目进简历" },
  { key: "weight", name: "体重", target: "≤58kg 达标" },
];

export const SEMESTER_PLAN: MonthPlan[] = [
  {
    title: "7月下 · 启动",
    period: "7/20 – 8/2",
    weight: "记录基线：体重 / 腰围 / 体态照，建立饮食记录习惯",
    goals: {
      sport: "周期① 适应周 ×2：把每天的动作学会，跟练只做 2/3 量",
      english: "摸底完成（A2：地基扎实、缺语法）；新概念一册开学，前段可加速",
      cert: "⏸ 已于 2026-09-01 暂停（时间并给 AI）",
      ai: "主线启动：晚间刷《AI for Everyone》、开「AI 名词手册」；周末先摸清两个项目现状",
    },
    weeks: [
      "W1 7/20–26：全线起步，本周唯一重点是把作息跑顺",
      "W2 7/27–8/2：英语摸底出结果，确定词汇书和精听配比",
    ],
  },
  {
    title: "8月 · 打地基",
    period: "8/3 – 8/30",
    weight: "月底 ≤65.5kg（-2kg）",
    goals: {
      sport: "周期① 完成 → 周期② 开始，心肺日开始足量",
      english: "新概念一册 L17–L60；基础 2000 词起步；查莉中字磨耳朵",
      cert: "⏸ 已暂停",
      ai: "看完 AI for Everyone + 3B1B 神经网络；周末给 NOC Sentinel 补使用数据统计",
    },
    weeks: [
      "W1 8/3–9：熟悉 NOC Sentinel 现状，列出可补的 evals/数据点",
      "W2 8/10–16：查莉进入逐句精听；体重首次复核",
      "W3 8/17–23：AI 名词手册过半；HCIA 复习过半",
      "W4 8/24–30：月度复盘：体重/词汇量/AI 进度对账",
    ],
  },
  {
    title: "9月 · 上强度",
    period: "8/31 – 9/27",
    weight: "月底 ≤63.5kg",
    goals: {
      sport: "周期②→③，心肺日 +10 分钟",
      english: "新概念一册收尾 L61–L72 → 二册开篇；影子跟读加量",
      cert: "⏸ 已暂停",
      ai: "李宏毅生成式AI导论 + 提示工程；给 life-dashboard 加第一个 AI 小功能",
    },
    weeks: [
      "W1–W2：李宏毅课前 6 讲（生成式 AI 是什么/怎么炼成的）",
      "W3：life-dashboard AI 功能选型、动手",
      "W4：Prompt 笔记成稿；月度对账",
    ],
  },
  {
    title: "10月 · 动起来",
    period: "9/28 – 11/1",
    weight: "月底 ≤61.5kg",
    goals: {
      sport: "引入走跑交替（先置办高支撑运动内衣 + 学跑姿视频），周期③→④",
      english: "新概念二册推进；启用新东方四级词汇；查莉切双字幕精听",
      cert: "⏸ 已暂停",
      ai: "RAG/Agent 概念；life-dashboard AI 功能做完（作品②）+ 写第一版项目文档",
    },
    weeks: [
      "W1：跑姿+跑前热身视频作业，快走里加 1 分钟慢跑段",
      "W2–W3：AI 小功能从想法到能用",
      "W4：英文对话首秀；月度对账",
    ],
  },
  {
    title: "11月 · 见真章",
    period: "11/2 – 11/29",
    weight: "月底 ≤59.5kg · 拍体态对比照复评",
    goals: {
      sport: "走跑交替进阶（跑段逐周加长），体态复评",
      english: "新概念二册；查莉英文字幕挑战；每周 2 次和 Claude 英文对话",
      cert: "⏸ 已暂停",
      ai: "评测(Evals)实战：给 NOC Sentinel 建评测集+抽检表（作品①升级）",
    },
    weeks: [
      "W1–W2：NOC Sentinel 评测集设计（抽检表+错误分类）",
      "W3：无字幕首刷试水",
      "W4：评测数据首次汇总；月度对账",
    ],
  },
  {
    title: "12月 · 收官验收",
    period: "11/30 – 12/27",
    weight: "12/27 验收：≤58kg 达标 / ≤56.5kg 优秀；聚餐季执行防反弹策略",
    goals: {
      sport: "维持强度；聚餐日先吃蛋白质、饮食记录不断",
      english: "里程碑：无字幕看一集查莉，目标听懂 ≥50-60%（A2 起步的务实线）",
      cert: "⏸ 已暂停；年底若想恢复，把 seed.ts 里那两条加回来",
      ai: "NOC Sentinel 复盘文档 + AI PM 简历/作品集成稿（两个作品都能讲清影响+evals+迭代）",
    },
    weeks: [
      "W1–W2：两个 AI 作品的项目文档定稿",
      "W3：英语里程碑测试 + AI 简历/作品集终稿",
      "W4 12/21–27：全年验收，写 2027 上半年计划",
    ],
  },
];
