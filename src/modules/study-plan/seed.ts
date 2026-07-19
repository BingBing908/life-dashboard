import type { Track } from "./data";

/** 种子模板版本号：每次修改 SEED_ITEMS 后 +1，已播种的设备会看到"模板有更新"横幅 */
export const SEED_VERSION = 19;

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
    track: "sport",
    days: "2,4,6",
    time_slot: "07:05–07:25",
    title: "足弓重建（跟国局八段锦同日）",
    detail: "拯救扁平足 / 优化下肢力线",
    url: "https://www.bilibili.com/video/BV1ofKEzjEUd/",
  },
  {
    track: "english",
    days: "*",
    time_slot: "07:30–07:40",
    title: "英语① 复习昨课·跟读",
    detail: "出声跟读昨天课文，激活记忆。进度自己走，看到哪算哪，不赶日期、不以「单元」为单位",
    url: "https://www.bilibili.com/video/BV1xa411J7jJ/",
  },
  {
    track: "english",
    days: "*",
    time_slot: "07:40–08:35",
    title: "英语② 学新课（刘羽Leo：单词→语法→文章）",
    detail: "新概念课两两成对：奇数课=新课文（单词21′+语法文章14′≈35′），偶数课=练习（留到次日当复习做）——一天只看新课文那一课，不必啃完整单元。前~24课可加速。纯动画备用 BV1MT4y1o7Cv。⏸ 学完起身5分钟",
    url: "https://www.bilibili.com/video/BV1xa411J7jJ/",
  },
  {
    track: "english",
    days: "*",
    time_slot: "08:40–09:05",
    title: "英语③ 朗读+跟读今天课文（站着做）",
    detail: "不用单独跟读视频——跟你刚学这课的音频出声模仿最有效；也可在「每日英语听力」搜新概念一册做精听跟读",
    url: "https://www.bilibili.com/video/BV1MT4y1o7Cv/",
  },
  {
    track: "english",
    days: "*",
    time_slot: "到公司后/通勤",
    title: "英语④ 不背单词 PEP（移出晨间）",
    detail: "移出晨间100分钟，放到公交上或到公司开工前背，时间自由；先清复习再学新词；骑电动车通勤日别看手机，到工位再背",
  },
  // ---------- 周末上午：AI 项目（主线） ----------
  {
    track: "ai",
    days: "6,7",
    time_slot: "09:20–12:00",
    title: "AI 项目完善（周末大块·主线）",
    detail: "给 NOC Sentinel 补评测(evals)+使用数据、给 life-dashboard 加 AI 功能，查漏补缺做完善；每完善一块就想「怎么写进简历」——量化影响+evals+迭代故事。前期还没上手时，先跟吴恩达《AI for Everyone》把概念看懂",
    url: "https://www.bilibili.com/video/BV1yC4y127uj/",
  },
  {
    track: "cert",
    days: "6",
    time_slot: "14:00–16:00",
    title: "华为认证·HCIE 实验（eNSP 大块）",
    detail: "冲 HCIE，但从 HCIA→HCIP 基础往上推进；周六下午整块时间正好做 eNSP 拓扑实验",
  },
  // ---------- 晚间学习 ----------
  {
    track: "ai",
    days: "1,2,4,5",
    time_slot: "19:00–19:40",
    title: "AI 刷课（晚间碎片）",
    detail: "沿路线看课：吴恩达 AI for Everyone→李宏毅生成式AI导论→Prompt→RAG/Agent；40分钟一小段，边看边记「AI 名词手册」",
    url: "https://www.bilibili.com/video/BV1yC4y127uj/",
  },
  {
    track: "cert",
    days: "3",
    time_slot: "19:00–19:40",
    title: "华为认证·HCIE 目标（理论/看课）",
    detail: "认证降为每周两次副线（周三晚看课+周六下午实验）；内容从 HCIA→HCIP 基础起步，逐步冲 HCIE",
  },
  {
    track: "english",
    days: "6",
    time_slot: "19:00–19:40",
    title: "英语·本周复盘",
  },
  // ---------- 晚间运动 ----------
  {
    track: "sport",
    days: "*",
    time_slot: "19:40–19:50",
    title: "腰椎稳定 10 分钟（每晚开场）",
    detail: "鸟狗式 / 侧桥 / 改良卷腹；⚠️ 出现放射性疼痛立即停",
    url: "https://www.bilibili.com/video/BV11f421Q7ZU/",
    period_action: "swap",
    period_title: "腰椎稳定·经期版 10 分钟",
    period_detail: "猫牛式 + 臀桥 + 髋部轻拉伸（不做任何卷腹/侧桥/平板）；⚠️ 出现放射性疼痛立即停",
  },
  {
    track: "sport",
    days: "1",
    time_slot: "19:50–20:40",
    title: "C戈·瘦斜方肌 20 分钟（针对斜方肌肥大）",
    detail: "正对你的斜方肌肥大；圆肩另配 C戈肩带综合矫正 BV15T411j7bs",
    url: "https://www.bilibili.com/video/BV1Qv411u7aF/",
  },
  {
    track: "sport",
    days: "2",
    time_slot: "19:50–20:40",
    title: "欧阳春晓·芭杆练手臂 x 薄背 20 分钟（全程站立）",
    url: "https://www.bilibili.com/video/BV11Autz4EoV/",
    period_action: "swap",
    period_detail: "🩸 经期：跳过视频里的卷腹/平板段落，其余照做",
  },
  {
    track: "sport",
    days: "3",
    time_slot: "19:50–20:40",
    title: "24 式太极·邱慧芳教学（分段学）",
    detail: "跟你收藏的邱慧芳教学版，一次学一两式",
    url: "https://www.bilibili.com/video/BV1iE411c7Ni/",
  },
  {
    track: "sport",
    days: "4",
    time_slot: "19:50–20:40",
    title: "欧阳春晓·王心凌金曲 15 分钟无跑跳有氧（心肺日）",
    detail: "明确无跑跳；累了降档成快走",
    url: "https://www.bilibili.com/video/BV1KCamz3EAz/",
    period_action: "swap",
    period_detail: "🩸 经期：跳过腹部段落，累了降档成快走",
  },
  {
    track: "sport",
    days: "5",
    time_slot: "19:50–20:40",
    title: "欧阳春晓·大腿内侧 x 盆底肌 x 骨盆稳定 20 分钟",
    detail: "针对骨盆前倾；膝超伸另配 C戈膝超伸矫正 BV1K7411b7yo",
    url: "https://www.bilibili.com/video/BV1PhHrzfEqN/",
  },
  {
    track: "sport",
    days: "6",
    time_slot: "19:50–20:40",
    title: "欧阳春晓·芭杆臀腿雕刻 30 分钟",
    detail: "或改太极复习 + 快走 30 分钟，二选一看状态",
    url: "https://www.bilibili.com/video/BV1FczFBcEBQ/",
  },
  {
    track: "sport",
    days: "7",
    time_slot: "19:50–20:40",
    title: "恢复日·欧阳春晓 17 分钟泡沫轴全身按摩",
    detail: "重点滚斜方肌和小腿",
    url: "https://www.bilibili.com/video/BV1pp4y1X7og/",
  },
  // ---------- 睡前 ----------
  {
    track: "wellness",
    days: "1,5,6,7",
    time_slot: "21:00–21:40",
    title: "泡脚",
    detail: "和阅读同时段，边泡边看书；水别太烫、15-20分钟即可；其他晚上想泡随时加",
  },
  {
    track: "reading",
    days: "*",
    time_slot: "21:00–21:40",
    title: "阅读（泡脚时段）",
    detail: "当前：《她对此感到厌烦》；之后：长安的荔枝→秋园→显微镜下的大明→82年生的金智英→万历十五年→始于极限→叫魂→翦商；历史类只收史实可靠的；50 页弃权规则，只记进度不设 KPI",
  },
  {
    track: "wellness",
    days: "*",
    time_slot: "21:40–22:00",
    title: "睡前拉伸",
    detail: "跟练 10-15 分钟；顺便吃当日补剂（小红镁/钙镁锌）",
    url: "https://www.bilibili.com/video/BV1UovWBNENi/",
  },
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
  "2026-12-27 验收总目标：体重 ≤58kg 达标 / ≤56.5kg 优秀（55kg 顺延至 2027 Q1，50kg 不设为目标）· 英语学完新概念一册、开二册，无字幕看《查莉》听懂 50-60%（A2 起步，务实目标）· 【主线】手握 2 个可写进简历的 AI 落地作品（NOC Sentinel 补 evals+数据、life-dashboard 加 AI 功能）+ 简历更新 · 【副线】华为认证按 HCIA→HCIP 稳步推进（周三晚+周六下午两次）";

export const SEMESTER_PLAN: MonthPlan[] = [
  {
    title: "7月下 · 启动",
    period: "7/20 – 8/2",
    weight: "记录基线：体重 / 腰围 / 体态照，建立饮食记录习惯",
    goals: {
      sport: "周期① 适应周 ×2：把每天的动作学会，跟练只做 2/3 量",
      english: "摸底完成（A2：地基扎实、缺语法）；新概念一册开学，前段可加速",
      cert: "副线启动（周三晚+周六下午）：从 HCIA 复习起步",
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
      cert: "HCIA 复习推进（每周两次的节奏，不赶）",
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
      cert: "HCIA 收尾 → HCIP 起步；周六下午 eNSP 入门实验",
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
      cert: "HCIP 科目一",
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
      cert: "HCIP 科目一收尾 / 科目二",
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
      cert: "HCIP 继续；年底看进度评估要不要提速冲 HCIE",
      ai: "NOC Sentinel 复盘文档 + AI PM 简历/作品集成稿（两个作品都能讲清影响+evals+迭代）",
    },
    weeks: [
      "W1–W2：两个 AI 作品的项目文档定稿",
      "W3：英语里程碑测试 + AI 简历/作品集终稿",
      "W4 12/21–27：全年验收，写 2027 上半年计划",
    ],
  },
];
