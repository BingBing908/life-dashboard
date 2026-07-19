import type { Track } from "./data";

/** 种子模板版本号：每次修改 SEED_ITEMS 后 +1，已播种的设备会看到"模板有更新"横幅 */
export const SEED_VERSION = 15;

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
}[] = [
  // ---------- 早晨 ----------
  {
    track: "wellness",
    days: "*",
    time_slot: "06:10–06:30",
    title: "仙人揉腹",
    url: "https://www.bilibili.com/video/BV1oh4y1d7kb/",
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
    time_slot: "07:30–07:45",
    title: "英语① 复习昨课·跟读",
    detail: "出声跟读昨天那课，激活记忆。进度自己走，学完一课才进下一课，不赶日期",
    url: "https://www.bilibili.com/video/BV1xa411J7jJ/",
  },
  {
    track: "english",
    days: "*",
    time_slot: "07:45–08:15",
    title: "英语② 学新课（刘羽Leo·单词→文章→语法）",
    detail: "主教材：刘羽Leo 199集覆盖全144课，含系统语法讲解。按当课「单词→文章→语法」顺序看完。前~24课可1.5倍速快进语法，第25课起(进行时/过去式)放慢逐句跟。纯动画备用 BV1MT4y1o7Cv。⏸ 学完起身拉伸5分钟（护腰+醒脑，别碰手机）",
    url: "https://www.bilibili.com/video/BV1xa411J7jJ/",
  },
  {
    track: "english",
    days: "*",
    time_slot: "08:20–08:50",
    title: "英语③ 影子跟读（站着做）",
    detail: "站着出声模仿台词——练听说，也顺便当活动。⏸ 完再起身走动5分钟",
    url: "https://www.bilibili.com/video/BV1PJ4m1M7a3/",
  },
  {
    track: "english",
    days: "*",
    time_slot: "08:55–09:10",
    title: "英语④ 不背单词（PEP 词库）",
    detail: "先清复习再学新词，~10个/天起步、时间盒20分钟；PEP背完自然交接到新概念生词+基础2000词",
  },
  // ---------- 周末上午 ----------
  {
    track: "ai",
    days: "6,7",
    time_slot: "09:20–12:00",
    title: "AI 学习（当前阶段：AI 是什么）",
    detail: "先看懂再动手！当前看吴恩达《AI for Everyone》中字视频课（不写代码、讲人话），边看边记一本「AI 名词手册」（遇到 模型/训练/token/幻觉 这类词就记下自己的白话解释）；整体路线见「路线」页；周六最后 40 分钟=本周补漏",
    url: "https://www.bilibili.com/video/BV1yC4y127uj/",
  },
  // ---------- 晚间学习 ----------
  {
    track: "cert",
    days: "1,2,3,4",
    time_slot: "19:00–19:40",
    title: "HCIP 课程学习",
    detail: "第 1-4 周复习 HCIA（视频课 1.5 倍速，每晚一节）；第 5 周起进 HCIP Datacom",
  },
  {
    track: "cert",
    days: "5",
    time_slot: "19:00–19:40",
    title: "HCIP 本周错题回顾",
    detail: "周五精力最差，只回顾不排新课",
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
    detail: "鸟狗式 / 侧桥 / 改良卷腹；⚠️ 出现放射性疼痛立即停；🩸 生理期中后段改做：猫牛式+臀桥+髋部轻拉伸（不做任何卷腹/侧桥/平板类）",
    url: "https://www.bilibili.com/video/BV11f421Q7ZU/",
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
    detail: "🩸 生理期：跳过卷腹/平板段落",
    url: "https://www.bilibili.com/video/BV11Autz4EoV/",
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
  "2026-12-27 验收总目标：体重 ≤58kg 达标 / ≤56.5kg 优秀（55kg 顺延至 2027 Q1，50kg 不设为目标）· 英语学完新概念一册、开二册，无字幕看《查莉》听懂 50-60%（A2 起步，务实目标）· HCIP 知识点全部过完 · 手握 2 个可写简历的 AI 落地作品";

export const SEMESTER_PLAN: MonthPlan[] = [
  {
    title: "7月下 · 启动",
    period: "7/20 – 8/2",
    weight: "记录基线：体重 / 腰围 / 体态照，建立饮食记录习惯",
    goals: {
      sport: "周期① 适应周 ×2：把每天的动作学会，跟练只做 2/3 量",
      english: "摸底完成（A2：地基扎实、缺语法）；新概念一册开学，前段可加速",
      cert: "HCIA 复习第 1-2 周：每晚一节视频课（1.5 倍速）",
      ai: "《AI for Everyone》中字开看，开一本「AI 名词手册」",
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
      cert: "HCIA 收尾 + 自测查漏 → 8/18 起进 HCIP 科目一",
      ai: "《AI for Everyone》看完 + 3Blue1Brown 神经网络中字系列；名词手册成形",
    },
    weeks: [
      "W1 8/3–9：HCIA 自测，错的章节重看",
      "W2 8/10–16：查莉进入逐句精听；体重首次复核",
      "W3 8/17–23：HCIP 开科；AI 名词手册过半",
      "W4 8/24–30：月度复盘：体重/词汇量/HCIP 进度三项对账",
    ],
  },
  {
    title: "9月 · 上强度",
    period: "8/31 – 9/27",
    weight: "月底 ≤63.5kg",
    goals: {
      sport: "周期②→③，心肺日 +10 分钟",
      english: "新概念一册收尾 L61–L72 → 二册开篇；影子跟读加量",
      cert: "HCIP 科目一过完；eNSP 入门实验（隔周周六上午）",
      ai: "李宏毅《生成式AI导论 2024》核心讲 + 吴恩达提示工程中字；产出 Prompt 实验笔记",
    },
    weeks: [
      "W1–W2：李宏毅课前 6 讲（生成式 AI 是什么/怎么炼成的）",
      "W3：第一次 eNSP 实验日",
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
      cert: "HCIP 科目二",
      ai: "RAG / Agent 概念 + 给 life-dashboard 搭一个 AI 小功能（作品②）",
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
      cert: "HCIP 科目三 + 错题本",
      ai: "评测(Evals)实战：给 NOC Sentinel 建评测集 + 使用数据统计（作品①升级）",
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
      cert: "HCIP 三科总复习 + 模拟卷，12/27 前知识点验收",
      ai: "NOC Sentinel 复盘文档 + AI PM 简历/作品集成稿",
    },
    weeks: [
      "W1–W2：HCIP 模拟卷两轮",
      "W3：英语里程碑测试 + AI 作品集终稿",
      "W4 12/21–27：全年六项验收，写 2027 上半年计划",
    ],
  },
];
