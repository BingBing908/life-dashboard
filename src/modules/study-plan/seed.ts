import type { Track } from "./data";

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
    track: "sport",
    days: "1,2,3,4,5",
    time_slot: "06:50–07:25",
    title: "八段锦（体育总局 12 分钟口令版）",
    url: "https://www.bilibili.com/video/BV1VsDpYXEqD/",
  },
  {
    track: "sport",
    days: "6,7",
    time_slot: "06:50–07:25",
    title: "八段锦（武当·袁师懋道长带练版）",
    detail: "先看讲解版学要领：bilibili.com/video/BV1sw411f71X",
    url: "https://www.bilibili.com/video/BV1Cv411N7bG/",
  },
  {
    track: "sport",
    days: "1,3,5,7",
    time_slot: "07:25–07:50",
    title: "足弓重建（隔天练）",
    detail: "拯救扁平足 / 优化下肢力线；不练的日子当早晨机动缓冲",
    url: "https://www.bilibili.com/video/BV1F31WYXERA/",
  },
  {
    track: "english",
    days: "*",
    time_slot: "08:10–09:20",
    title: "英语·听说训练（空腹在家）",
    detail: "10min复习昨日 + 25min精听 + 20min跟读输出 + 15min核心词汇；公交日路上泛听已学内容；教材待摸底测试后定",
  },
  // ---------- 周末上午 ----------
  {
    track: "ai",
    days: "6,7",
    time_slot: "09:20–12:00",
    title: "AI 产品方向（周末大块）",
    detail: "路线：大模型原理→Prompt→RAG/Agent→评测(Evals)；优先给 NOC Sentinel 补评测机制与使用数据；周六最后 40 分钟=本周补漏时段；HCIP 实验期每两周挪一个周六上午做 eNSP",
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
    detail: "鸟狗式 / 侧桥 / 改良卷腹；⚠️ 出现放射性疼痛立即停",
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
    detail: "入门介绍：bilibili.com/video/BV1BxwXzAEwk",
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
    detail: "首选欧阳春晓 24 年后的无跑跳新片（B站搜）；此链接为备选",
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
];
