/**
 * 总览「四条线」卡的纯计算（2026-07-30 加）。
 *
 * 为什么有这张卡：PRODUCT.md 的成功标准写着「这个工具的成败 ＝ 英语/华为认证/AI/体重
 * 四条线有没有推进」，但总览上原来只有体重看得见。顶排的「时间轴 3/12」是今天勾了几格，
 * 不是「这条线推到哪了」。
 *
 * ⚠️⚠️ **这张卡刻意不显示进度条/百分比，因为三条线里没有分母**（2026-07-30 定，
 * Rosie 直接问了「除了体重，你怎么判断其他三个方向的进度」，查完真实数据的结论）：
 *   · 英语——她刻意不按集数走（固定流程＋进度指针，复健期学习者不赶日期）；
 *   · 华为认证——没有可量化的题库/课程进度；
 *   · AI——两个项目没有 checklist。
 * 硬造一个分母就是编数字。所以这张卡只回答**「最近动过没有」＋「她自己写的那句进度」**，
 * 这也正好是「连续性 > 进度速度」那条产品取向。
 *
 * 三层数据，边界必须分清：
 *   ① **自动、可靠**＝来自 `plan_checks`：最近一次 done 是哪天、本周推进了几天。
 *   ② **原样显示、绝不解析**＝来自 `plan_notes` 的最近一条笔记原文。
 *      ⚠️ 别去解析「三年级下」是第几册、别把「刷完 001」换算成百分比——那是猜，一猜就错。
 *   ③ **人工维护**＝`seed.ts` 的 `LINE_TARGETS`（第三行的目标标签）。
 */
import { daysBetween } from "@/lib/dates";
import {
  matchesDay,
  type CheckStatus,
  type PlanItem,
  type Track,
} from "@/modules/study-plan/data";
import { LINE_TARGETS } from "@/modules/study-plan/seed";

/** 某一天的打卡快照（总览本来就为「本周完成柱」逐天查了，复用同一份，别再查一遍） */
export interface DaySnapshot {
  date: string;
  /** 1=周一 … 7=周日 */
  dayNum: number;
  status: Map<string, CheckStatus>;
}

export interface LineCell {
  key: "english" | "cert" | "ai" | "weight";
  name: string;
  /** 进度指针：她自己写的最近一条笔记原文；体重是「69.1 → 58」；没有则 null */
  pointer: string | null;
  /** 指针来自哪个条目 + 哪天（tooltip 用，让她知道这句话是哪天写的） */
  pointerFrom: string | null;
  /** 第二行：最近动过 + 本周推进天数 */
  status: string;
  /** 这条线该被提醒了（本周该做却 0 天推进 / 从未推进） */
  warn: boolean;
  target: string;
  /** 点这一格跳哪个模块 */
  moduleId: string;
}

const PLAN_LINES: { key: "english" | "cert" | "ai"; track: Track }[] = [
  { key: "english", track: "english" },
  { key: "cert", track: "cert" },
  { key: "ai", track: "ai" },
];

/** 「N 天前」的人话。今天/昨天/前天单独说，再远就给天数。 */
function relDay(date: string, today: string): string {
  const n = daysBetween(date, today);
  if (n <= 0) return "今天";
  if (n === 1) return "昨天";
  if (n === 2) return "前天";
  return `${n} 天前`;
}

/**
 * 算某条计划线（英语/认证/AI）的一格。
 *
 * ⚠️ **进度指针取「该线最近一条有笔记的条目」**（2026-07-30 Rosie 选的方案 A，
 * 备选 B 是钉死主线条目）。A 显示「实际在发生什么」——所以英语会显示单词线的进度
 * （因为晨间主线那三条一条笔记都没有、6 次打卡全是 skip），认证会显示「还没有进度记录」。
 * B 显示「本来该发生什么」，代价是那两格长期空着、看几天就被无视。她要 A。
 *
 * ⚠️ **本周按「天」数，不按「条目次数」数**：一条线底下条目数量差很多
 * （英语 5 条、认证 2 条），按次数算，英语天然一大串、认证天然很小，两格没法比。
 * 按天数就都是 0–7，而且「连续性」本来就是按天定义的。
 */
function planLine(
  key: "english" | "cert" | "ai",
  track: Track,
  items: PlanItem[],
  week: DaySnapshot[],
  latestDone: Record<string, string>,
  latestNote: Record<string, { note: string; date: string }>,
  today: string,
): LineCell {
  const cfg = LINE_TARGETS.find((l) => l.key === key)!;
  const mine = items.filter((i) => i.track === track);

  // ── ① 指针：该线所有条目里，笔记日期最新的那条
  let pointer: string | null = null;
  let pointerFrom: string | null = null;
  let best = "";
  for (const it of mine) {
    const n = latestNote[it.id];
    if (n && n.date > best) {
      best = n.date;
      pointer = n.note;
      pointerFrom = `${it.title} · ${n.date} 写的`;
    }
  }

  // ── ② 最近一次真的完成（skip 已在 latestDoneByItem 里排掉）
  let lastDone = "";
  for (const it of mine) {
    const d = latestDone[it.id];
    if (d && d > lastDone) lastDone = d;
  }

  // ── ③ 本周：推进了几天 / 该做几天（只算已经过去的天，将来的不算进分母）
  let due = 0;
  let advanced = 0;
  for (const day of week) {
    const scheduled = mine.filter((i) => matchesDay(i, day.dayNum));
    if (scheduled.length === 0) continue;
    due++;
    if (scheduled.some((i) => day.status.get(i.id) === "done")) advanced++;
  }

  const weekPart = due > 0 ? `本周 ${advanced}/${due} 天` : "本周没排";
  const status = lastDone ? `最近 ${relDay(lastDone, today)} · ${weekPart}` : `还没推进过 · ${weekPart}`;

  return {
    key,
    name: cfg.name,
    pointer,
    pointerFrom,
    status,
    // 该做却一天没动，或从来没动过 ⇒ 提醒。这是「哪条线断了」，不是催她进度快。
    warn: (due > 0 && advanced === 0) || !lastDone,
    target: cfg.target,
    moduleId: "study-plan",
  };
}

/**
 * 体重那一格：唯一能自动算出「离目标还差多少」的线（有真数字）。
 * ⚠️ 跟三条计划线**分开导出**是刻意的：体重要跟着她在总览里现填的数字实时变，
 * 所以在**渲染时**从 weightLog state 算；三条计划线要查库、只能在 effect 里算一次。
 * 硬合成一个函数就得把 weightLog 塞进 effect 依赖，她一改数字就重查一遍库。
 */
export function buildWeightLine(latestAm: number | null, goal: number): LineCell {
  const cfg = LINE_TARGETS.find((l) => l.key === "weight")!;
  return {
    key: "weight",
    name: cfg.name,
    pointer: latestAm != null ? `${latestAm} → ${goal}` : null,
    pointerFrom: latestAm != null ? "最近一次今晨空腹" : null,
    status:
      latestAm == null
        ? "还没记空腹体重"
        : latestAm > goal
          ? `还差 ${(latestAm - goal).toFixed(1)}kg`
          : "已达标 🎉",
    // ⚠️ **体重刻意不做「天级缺口提醒」**（2026-07-30 定）：她漏了就跳过、不回头补
    // （「上一次漏掉看体重是前天 → 跳过没写，直接写了新的」），天天红字只会变成噪音。
    // 这一格只在压根没有数据时才提醒。
    warn: latestAm == null,
    target: cfg.target,
    moduleId: "supplement",
  };
}

/** 距验收日还有几天（负数＝已过） */
export function daysToAcceptance(today: string, acceptance: string): number {
  return daysBetween(today, acceptance);
}

/* 本周各天的打卡快照由调用方（DashboardShell）在它**本来就有的**「本周完成柱」循环里
 * 一并收集成 `DaySnapshot[]` 传进来——别在这里再写一个 weekDaysSoFar 然后逐天查库，
 * 那是把同一批查询做两遍。 */

/** 三条计划线（英语/认证/AI）。体重那格另走 `buildWeightLine`，见它上面的注释。 */
export function buildPlanLines(
  items: PlanItem[],
  week: DaySnapshot[],
  latestDone: Record<string, string>,
  latestNote: Record<string, { note: string; date: string }>,
  today: string,
): LineCell[] {
  return PLAN_LINES.map((l) => planLine(l.key, l.track, items, week, latestDone, latestNote, today));
}
