import { addDays, daysBetween, todayStr } from "@/lib/dates";
import type { Entry } from "./data";

/**
 * 间隔复习排程（纯函数，无副作用，便于别处复用/测试）。
 *
 * 旧版复习板块只拉「昨天」的内容 —— 过了一天就再也不出现，学过的实际上在漏。
 * 现在改成艾宾浩斯式间隔：学完后第 1/3/7/15/30 天各复习一次，五次全默到全对＝毕业。
 *
 * 进度存在 `meta.revs`（历次通过日期数组，升序）。旧数据只有单个 `meta.reviewedAt`，
 * 读的时候当作 `[reviewedAt]` 兼容；写的时候两个都写，老版本页面也不至于读空。
 */

/** 第几次复习安排在学完后的第几天 */
export const REVIEW_INTERVALS = [1, 3, 7, 15, 30];

/**
 * 会进复习队列的内容类型。
 *
 * ⚠️ **加类型前先算稳态负担**：间隔是 5 段，所以
 * 「每天到期条数 ＝ 5 × 每天新进队列的条数」。每天进 2 条 → 稳态每天要复习 10 条。
 * 所以贵的（全文默写 5–9 分钟）要克制，便宜的（一句/一个词，20 秒）可以多加。
 * 历史/练笔/AI 新闻/书影/金融**刻意不进**：故事和输出型内容没有「精确记住」这回事。
 *
 * `mode` 决定用哪种复习形式：
 * · `dictation` → 整篇默写 + 逐句订正（ReviewDictation）
 * · `recall`    → 看提示答一个答案（ReviewQuiz），用于成语这种「要能调得出来」的
 */
export type ReviewMode = "dictation" | "recall";

export interface ReviewKind {
  board: string;
  kind: string;
  label: string;
  mode: ReviewMode;
}

export const REVIEW_KINDS: ReviewKind[] = [
  { board: "chinese", kind: "古诗", label: "古诗", mode: "dictation" },
  { board: "english", kind: "精读文章", label: "英语精读", mode: "dictation" },
  // 2026-07-28 加：谚语短、复习成本约 20 秒，性价比最高
  { board: "english", kind: "谚语", label: "英语谚语", mode: "dictation" },
  // 2026-07-28 加：成语用 recall（看意思答成语），约 25 秒
  { board: "chinese", kind: "成语", label: "成语", mode: "recall" },
];

export function reviewKindOf(e: Entry): ReviewKind | null {
  return REVIEW_KINDS.find((k) => k.board === e.board && k.kind === e.kind) ?? null;
}

/** 会进复习队列吗（没有 entry_date 的排不了程；recall 型还要能抽出题面，
 *  否则会排出一道没有题目的题——宁可不排） */
export function isReviewable(e: Entry): boolean {
  if (!e.entry_date) return false;
  const k = reviewKindOf(e);
  if (!k) return false;
  if (k.mode === "recall") return !!recallCard(e);
  return true;
}

function metaObj(e: Entry): Record<string, unknown> {
  try {
    return e.meta ? JSON.parse(e.meta) : {};
  } catch {
    return {};
  }
}

/**
 * 一次复习通过的记录。
 * `wrong`/`rounds` 是 2026-07-28 加的「难度」信息——只有日期答不了
 * 「我是真记牢了还是每次都在重新背」这个问题（Rosie 的用户故事原话）。
 * 老数据里 `revs` 是纯日期字符串、更老的只有单个 `reviewedAt`，读的时候统一归一成这个形状。
 */
export interface RevRecord {
  /** 通过那天 */
  d: string;
  /** 第一遍整篇默写错了几句（0＝一遍过）；老记录没有，为 undefined */
  wrong?: number;
  /** 一共默了几轮才全对（1＝一次过）；老记录没有 */
  rounds?: number;
}

/** 历次复习记录（升序、按日期去重）。兼容纯字符串数组和旧的 reviewedAt 单值 */
export function reviewLog(e: Entry): RevRecord[] {
  const m = metaObj(e);
  const raw: unknown[] = Array.isArray(m.revs)
    ? (m.revs as unknown[])
    : typeof m.reviewedAt === "string" && m.reviewedAt
      ? [m.reviewedAt]
      : [];
  const byDate = new Map<string, RevRecord>();
  for (const r of raw) {
    if (typeof r === "string" && r) {
      if (!byDate.has(r)) byDate.set(r, { d: r });
    } else if (r && typeof r === "object" && typeof (r as RevRecord).d === "string") {
      const rec = r as RevRecord;
      // 同一天重复出现时，保留带难度信息的那条
      const prev = byDate.get(rec.d);
      if (!prev || prev.wrong === undefined) byDate.set(rec.d, rec);
    }
  }
  return [...byDate.values()].sort((a, b) => a.d.localeCompare(b.d));
}

/** 历次复习通过的日期（升序、去重）——排程只关心日期 */
export function reviewDates(e: Entry): string[] {
  return reviewLog(e).map((r) => r.d);
}

/** 已通过几次（0 ＝ 学完还没复习过） */
export function reviewStage(e: Entry): number {
  return reviewDates(e).length;
}

/** 五个间隔全走完＝记牢了，不再进队列 */
export function isGraduated(e: Entry): boolean {
  return reviewStage(e) >= REVIEW_INTERVALS.length;
}

/** 下一次该复习的日期；已毕业/无日期返回 null */
export function nextDue(e: Entry): string | null {
  if (!e.entry_date || isGraduated(e)) return null;
  return addDays(e.entry_date, REVIEW_INTERVALS[reviewStage(e)]);
}

/**
 * 今天该不该复习：到期（含逾期）且今天还没默到全对。
 * 「今天已通过」的排除保证一条内容一天最多推进一级 —— 长期没打开时不会一天里把
 * 1/3/7/15/30 五轮全怼到脸上，而是每天补一轮慢慢追上。
 */
export function isDueToday(e: Entry, today = todayStr()): boolean {
  if (!isReviewable(e)) return false;
  if (reviewDates(e).includes(today)) return false;
  const due = nextDue(e);
  return !!due && due <= today;
}

/** 逾期天数（0 ＝ 正好今天到期） */
export function overdueDays(e: Entry, today = todayStr()): number {
  const due = nextDue(e);
  if (!due) return 0;
  return Math.max(0, daysBetween(due, today));
}

/** 从 body 里抽古诗的【原诗】段（body 常含【注释】【白话】等大段，不能拿整段当答案） */
function poemBody(e: Entry): string {
  const m = (e.body ?? "").match(/【原诗】([\s\S]*?)(?=\n*【|$)/);
  return m ? m[1].trim() : "";
}

const lines = (s: string): string[] =>
  s.split("\n").map((x) => x.trim()).filter(Boolean);

/**
 * 拆掉古诗的「题头」（标题行 + 作者行），只留诗句。
 *
 * ⚠️ **2026-07-29 修的真 bug**：Rosie 把《塞下曲》正文一字不差地默对了，却被判错——
 * 因为 `meta.recite` 里连标题和作者一起存着（「塞下曲 · 其三　卢纶〔唐〕」），
 * 她写成「塞下曲其三 唐卢纶」，格式不同就算错。**标题和作者不该是默写内容**，
 * 它们是「要默哪一首」的提示。
 *
 * 判据：诗句一定含中文标点（，。！？；），题头行不含。从头往下扫，
 * 连续不含标点的短行都算题头，遇到第一行带标点的就开始算正文。
 */
function splitPoem(text: string): { head: string; body: string } {
  const ls = lines(text);
  const head: string[] = [];
  let i = 0;
  while (i < ls.length && !/[，。！？；]/.test(ls[i]) && ls[i].length <= 24) {
    head.push(ls[i]);
    i++;
  }
  // 万一整段都不含标点（异常数据），别把正文吃光——那就当没有题头
  if (i >= ls.length) return { head: "", body: ls.join("\n") };
  return { head: head.join(" · "), body: ls.slice(i).join("\n") };
}

/** 正文第一行非空文本（英语谚语的英文句就在第一行） */
function firstLine(e: Entry): string {
  return lines(e.body ?? "")[0] ?? "";
}

/**
 * 复习时给的**提示**——不用默，只用来认出「这是哪一条」。
 *
 * ⚠️ 没有提示是不行的（2026-07-29 Rosie 反馈）：英语谚语只给一个空框，
 * 她根本想不起来该默哪句；精读文章同理。提示的原则是
 * **给足够认出来的信息，但不能把答案给出去**：
 * · 古诗 → 标题 + 作者（诗句才是要默的）
 * · 英语谚语 → 中文释义（英文句才是要默的）
 * · 英语精读 → 整段中文翻译（英文才是要默的）
 */
export function reviewHint(e: Entry): string {
  const m = metaObj(e);
  if (e.kind === "古诗") {
    const src = (typeof m.recite === "string" && m.recite.trim()) || poemBody(e) || e.body || "";
    return splitPoem(src).head;
  }
  if (e.kind === "谚语") {
    // body 第一行是英文句，第二行是中文释义
    return lines(e.body ?? "")[1] ?? "";
  }
  if (e.kind === "精读文章") {
    return typeof m.article_cn === "string" ? m.article_cn : "";
  }
  return "";
}

/** 提示该怎么显示（古诗的题头是一行，精读的中文是一大段，样式不一样） */
export function hintLabel(e: Entry): string {
  if (e.kind === "古诗") return "默这一首";
  if (e.kind === "谚语") return "这句中文是";
  if (e.kind === "精读文章") return "中文对照（照它默英文）";
  return "提示";
}

/**
 * 这一轮该默什么。
 *
 * ⚠️ **精读第 3 轮起降级**（2026-07-28）：精读全文默写一次要 8–9 分钟，占稳态复习
 * 时间的大头（约 70%）。所以第 1、2 次默全文，第 3、4、5 次只默背诵句
 * （`meta.recite`，没有就退回全文首句）。精读的稳态成本因此从约 45 分钟降到约 20 分钟，
 * 腾出来的空间才装得下谚语和成语。
 *
 * @param stage 已通过次数（0 ＝ 这是第 1 次复习）
 */
export function reviewTarget(e: Entry, stage = 0): string {
  const m = metaObj(e);
  const recite = typeof m.recite === "string" ? m.recite.trim() : "";

  if (e.kind === "精读文章") {
    const full = (typeof m.article_en === "string" ? m.article_en : "") || e.body || "";
    if (stage < 2) return full;
    return recite || full.split(/(?<=[.!?])\s+/)[0] || full;
  }
  if (e.kind === "谚语") return recite || firstLine(e);
  // 古诗：⚠️ 必须剥掉题头（标题/作者），它们是提示不是答案——见 splitPoem 的注释
  const poemSrc = recite || poemBody(e) || e.body || "";
  return splitPoem(poemSrc).body || poemSrc;
}

/** 这一轮默的是「只背诵句」而不是全文——UI 要说清楚，否则她会以为文章被弄丢了 */
export function isShortRound(e: Entry, stage = 0): boolean {
  return e.kind === "精读文章" && stage >= 2;
}

/** 从 body 抽某个【小节】的内容（成语的 body 是【读音】【意思】【出处】【例句】这种分节格式） */
function section(e: Entry, name: string): string {
  const m = (e.body ?? "").match(new RegExp(`【${name}】([\\s\\S]*?)(?=\\n*【|$)`));
  return m ? m[1].trim() : "";
}

/**
 * recall 模式的题目：题面＝意思，答案＝成语本身。
 * 成语的标题格式是「成语 · 一鼓作气」，所以答案取 `·` 之后那截；
 * 万一哪天标题不带前缀，就整个标题当答案。
 * ⚠️ 抽不出意思（body 没有【意思】节）就返回 null——宁可不排这条，
 * 也别给一道没有题面的题。
 */
export function recallCard(e: Entry): { prompt: string; answer: string; hint?: string } | null {
  const answer = (e.title ?? "").split("·").pop()?.trim() ?? "";
  const prompt = section(e, "意思");
  if (!answer || !prompt) return null;
  const src = section(e, "出处");
  return { prompt, answer, hint: src ? src.split("\n")[0].slice(0, 60) : undefined };
}

/** 今天要复习的，学得早的排前面（也就是逾期最久的先还） */
export function dueEntries(entries: Entry[], today = todayStr()): Entry[] {
  return entries
    .filter((e) => isDueToday(e, today))
    .sort((a, b) => (a.entry_date ?? "").localeCompare(b.entry_date ?? ""));
}

/** 未来还排着的复习：{ 日期: 条数 }，只看今天之后 */
export function upcomingByDate(
  entries: Entry[],
  today = todayStr(),
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    if (!isReviewable(e) || isGraduated(e)) continue;
    const due = nextDue(e);
    if (due && due > today) out[due] = (out[due] ?? 0) + 1;
  }
  return out;
}

/**
 * 记一次通过，返回给 patchEntry 的 meta 补丁（同一天重复调用是空补丁）。
 * `stats` 是这次默写的难度（第一遍错几句 / 默了几轮），没传就只记日期。
 * 同时写 `reviewedAt`＝最后一次通过日，让还没更新的老版本页面也读得到。
 */
export function passPatch(
  e: Entry,
  today = todayStr(),
  stats?: { wrong: number; rounds: number },
): Record<string, unknown> {
  const log = reviewLog(e);
  if (log.some((r) => r.d === today)) return {};
  const rec: RevRecord = stats ? { d: today, wrong: stats.wrong, rounds: stats.rounds } : { d: today };
  return { revs: [...log, rec].sort((a, b) => a.d.localeCompare(b.d)), reviewedAt: today };
}

/** 这条内容的复习「完整曲线」：五个间隔各自的状态，供 ReviewTrack 画 */
export type StepState = "passed" | "due" | "upcoming";
export interface ReviewStep {
  /** 第几次（1..5） */
  n: number;
  /** 学完后第几天 */
  interval: number;
  state: StepState;
  /** 计划日期（未通过的）或实际通过日期（已通过的） */
  date: string | null;
  rec?: RevRecord;
}

export function reviewSteps(e: Entry, today = todayStr()): ReviewStep[] {
  const log = reviewLog(e);
  return REVIEW_INTERVALS.map((interval, idx) => {
    const rec = log[idx];
    if (rec) return { n: idx + 1, interval, state: "passed" as StepState, date: rec.d, rec };
    const planned = e.entry_date ? addDays(e.entry_date, interval) : null;
    // 只有「下一个该做的」那一格算 due，后面的都是 upcoming
    const state: StepState = idx === log.length && planned && planned <= today ? "due" : "upcoming";
    return { n: idx + 1, interval, state, date: planned };
  });
}
