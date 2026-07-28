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

/** 会进复习队列的内容：语文古诗 + 英语精读（都是要默写的） */
export function isReviewable(e: Entry): boolean {
  return (
    !!e.entry_date &&
    ((e.board === "chinese" && e.kind === "古诗") ||
      (e.board === "english" && e.kind === "精读文章"))
  );
}

function metaObj(e: Entry): Record<string, unknown> {
  try {
    return e.meta ? JSON.parse(e.meta) : {};
  } catch {
    return {};
  }
}

/** 历次复习通过的日期（升序、去重）。兼容旧字段 reviewedAt */
export function reviewDates(e: Entry): string[] {
  const m = metaObj(e);
  const raw = Array.isArray(m.revs)
    ? (m.revs as unknown[]).filter((d): d is string => typeof d === "string")
    : typeof m.reviewedAt === "string" && m.reviewedAt
      ? [m.reviewedAt]
      : [];
  return [...new Set(raw)].sort();
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

/** 记一次通过，返回给 patchEntry 的 meta 补丁（同一天重复调用是空补丁） */
export function passPatch(e: Entry, today = todayStr()): Record<string, unknown> {
  const revs = reviewDates(e);
  if (revs.includes(today)) return {};
  return { revs: [...revs, today].sort(), reviewedAt: today };
}
