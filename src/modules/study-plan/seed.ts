import type { Track } from "./data";

/** 种子模板版本号：每次修改 SEED_ITEMS 后 +1，已播种的设备会看到"模板有更新"横幅 */
export const SEED_VERSION = 4;

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
    title: "八段锦（国家体育总局版）",
    detail: "与武当版隔天交替；练完接足弓训练",
    url: "https://www.bilibili.com/video/BV1jG411c7yo/",
  },
  {
    track: "wellness",
    days: "2,4,6",
    time_slot: "06:50–07:25",
    title: "八段锦（武当版）",
    detail: "与国局版隔天交替；今天不排足弓，多出的时间当早晨缓冲",
    url: "https://www.bilibili.com/video/BV1ZK411z7wY/",
  },
  {
    track: "sport",
    days: "1,3,5,7",
    time_slot: "07:25–07:50",
    title: "足弓重建（跟国局八段锦同日）",
    detail: "拯救扁平足 / 优化下肢力线",
    url: "https://www.bilibili.com/video/BV1ofKEzjEUd/",
  },
  {
    track: "english",
    days: "*",
    time_slot: "08:10–09:20",
    title: "英语·听说训练（空腹在家）",
    detail: "教材：《查莉成长日记》S1 当精听材料。10min复习昨日 + 25min精听一小段（先双字幕→逐句听懂）+ 20min跟读模仿台词 + 15min高频词；公交日路上泛听已学的片段",
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
    title: "上背 / 圆肩驼背纠正",
    detail: "注意别练大斜方肌，看视频要点",
    url: "https://www.bilibili.com/video/BV1P5411Y7DW/",
  },
  {
    track: "sport",
    days: "2",
    time_slot: "19:50–20:40",
    title: "芭杆 Barre 塑形（全程站立）",
    detail: "入门介绍：bilibili.com/video/BV1BxwXzAEwk；🩸 生理期：跳过视频里的卷腹/平板段落",
    url: "https://www.bilibili.com/video/BV11Autz4EoV/",
  },
  {
    track: "sport",
    days: "3",
    time_slot: "19:50–20:40",
    title: "24 式太极·分段学习",
    detail: "教学参考邱慧芳央视版：bilibili.com/video/BV1w5411t7Xj",
    url: "https://www.bilibili.com/video/BV1wGKWeyEzj/",
  },
  {
    track: "sport",
    days: "4",
    time_slot: "19:50–20:40",
    title: "站立有氧·心肺日（无跑跳）",
    detail: "首选欧阳春晓 24 年后的无跑跳新片（B站搜）；此链接为备选；🩸 生理期：跳过腹部段落，累了降档成快走",
    url: "https://www.bilibili.com/video/BV1kts5zoErK/",
  },
  {
    track: "sport",
    days: "5",
    time_slot: "19:50–20:40",
    title: "骨盆前倾 / 下肢力线矫正",
    detail: "搭配 9090 呼吸法：bilibili.com/video/BV1XdrHBSEAM",
    url: "https://www.bilibili.com/video/BV1xA411h7jf/",
  },
  {
    track: "sport",
    days: "6",
    time_slot: "19:50–20:40",
    title: "太极复习 + 快走 30 分钟",
  },
  {
    track: "sport",
    days: "7",
    time_slot: "19:50–20:40",
    title: "恢复日：筋膜球放松 + 轻拉伸",
    detail: "重点滚斜方肌和小腿",
    url: "https://www.bilibili.com/video/BV1A54y1S7mn/",
  },
  // ---------- 睡前 ----------
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
    title: "睡前筋膜拉伸 + 补剂",
    detail: "跟练 10-15 分钟；按作息表当日补剂（小红镁/钙镁锌）",
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
  "2026-12-27 验收总目标：体重 ≤58kg 达标 / ≤56.5kg 优秀（55kg 顺延至 2027 Q1，50kg 不设为目标）· 英语无字幕看《查莉》听懂 60-70% · HCIP 知识点全部过完 · 手握 2 个可写简历的 AI 落地作品";

export const SEMESTER_PLAN: MonthPlan[] = [
  {
    title: "7月下 · 启动",
    period: "7/20 – 8/2",
    weight: "记录基线：体重 / 腰围 / 体态照，建立饮食记录习惯",
    goals: {
      sport: "周期① 适应周 ×2：把每天的动作学会，跟练只做 2/3 量",
      english: "完成摸底测试（对话快测 + EF SET），音标纠音起步",
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
      english: "高频词 0→1000；查莉 S1 双字幕精听，每天一小段",
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
      english: "高频词 2000；查莉切英文单字幕；开始影子跟读台词",
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
      english: "半字幕挑战（生词才暂停）；每周 2 次和 Claude 英文对话",
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
      english: "无字幕首刷简单集，听不懂的逐句复盘",
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
      english: "里程碑测试：无字幕看一集查莉，目标听懂 ≥60-70%",
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
