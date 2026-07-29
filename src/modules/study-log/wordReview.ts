import { addDays, daysBetween, todayStr } from "@/lib/dates";
import type { Entry } from "./data";
import { REVIEW_GAPS, type RevRecord } from "./review";

/**
 * 单词级间隔复习。
 *
 * ⚠️ **调度单位是「单个词」，不是「某篇精读的整个单词本」**——这是 Anki 按卡片
 * 调度而不是按牌组调度的原因：同一篇里 get up 可能一遍就记住、reluctant 反复错，
 * 按篇复习会让已经会的词陪着不会的词一起重复，白花时间。
 *
 * **不建新表**（跟零食复用 treat_log 同一个思路，Rosie 不用去 Supabase 跑 SQL）：
 * 进度存在所属精读条目的 `meta.wordSrs` 里，键＝英文原词。
 *   meta.wordSrs = { "reluctant": [{d:"2026-07-29", wrong:0, rounds:1}], ... }
 * 单词的「学习日」＝所属条目的 entry_date，所以到期计算跟条目那套完全一致。
 *
 * 代价：查队列要扫一遍所有精读条目（listAllEntries 本来就全量加载，可以接受）。
 */

export interface WordCard {
  /** 所属条目 id——回写进度时要用 */
  entryId: string;
  /** 条目标题，做题时显示来源 */
  entryTitle: string;
  /** 学习日＝条目的 entry_date */
  learnedOn: string;
  en: string;
  cn: string;
  /** 已通过次数 */
  stage: number;
  /** 该复习的日期（已逾期就是过去的日期） */
  due: string;
  overdue: number;
  log: RevRecord[];
}

interface RawWord {
  en?: unknown;
  cn?: unknown;
}

function metaObj(e: Entry): Record<string, unknown> {
  try {
    return e.meta ? JSON.parse(e.meta) : {};
  } catch {
    return {};
  }
}

/** 某条目的单词本（meta.words），过滤掉没有英文的脏数据 */
export function wordsOf(e: Entry): { en: string; cn: string }[] {
  const m = metaObj(e);
  if (!Array.isArray(m.words)) return [];
  return (m.words as RawWord[])
    .map((w) => ({
      en: typeof w?.en === "string" ? w.en.trim() : "",
      cn: typeof w?.cn === "string" ? w.cn.trim() : "",
    }))
    .filter((w) => w.en.length > 0);
}

/** 某条目里各词的复习记录（`meta.wordSrs`），归一成 RevRecord[] */
export function wordSrsOf(e: Entry): Record<string, RevRecord[]> {
  const m = metaObj(e);
  const raw = m.wordSrs;
  const out: Record<string, RevRecord[]> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(v)) continue;
    const recs: RevRecord[] = [];
    for (const r of v) {
      if (typeof r === "string" && r) recs.push({ d: r });
      else if (r && typeof r === "object" && typeof (r as RevRecord).d === "string") {
        recs.push(r as RevRecord);
      }
    }
    out[k] = recs.sort((a, b) => a.d.localeCompare(b.d));
  }
  return out;
}

/** 单词是不是过满 5 轮＝记牢了 */
export function wordGraduated(stage: number): boolean {
  return stage >= REVIEW_GAPS.length;
}

/**
 * 今天到期的单词队列（逾期最久的排前面）。
 * 只看精读条目——单词本只长在那儿。
 */
export function dueWords(entries: Entry[], today = todayStr()): WordCard[] {
  const out: WordCard[] = [];
  for (const e of entries) {
    if (e.kind !== "精读文章" || !e.entry_date) continue;
    const srs = wordSrsOf(e);
    for (const w of wordsOf(e)) {
      const log = srs[w.en] ?? [];
      const stage = log.length;
      if (wordGraduated(stage)) continue;
      if (log.some((r) => r.d === today)) continue; // 今天已过，一天最多推进一级
      // 锚点＝**上次答对那天**（没答过就是学完那天），跟条目排程同一套规则：
      // 拖延就顺延，不会一直挂着逾期。见 review.ts 的 REVIEW_GAPS
      const anchor = log.length ? log[log.length - 1].d : e.entry_date;
      const due = addDays(anchor, REVIEW_GAPS[stage]);
      if (due > today) continue;
      out.push({
        entryId: e.id,
        entryTitle: e.title ?? "",
        learnedOn: e.entry_date,
        en: w.en,
        cn: w.cn,
        stage,
        due,
        overdue: Math.max(0, daysBetween(due, today)),
        log,
      });
    }
  }
  return out.sort((a, b) => a.due.localeCompare(b.due) || a.en.localeCompare(b.en));
}

/** 整体进度：一共多少词、毕业多少、今天到期多少 */
export function wordStats(entries: Entry[], today = todayStr()) {
  let total = 0;
  let graduated = 0;
  for (const e of entries) {
    if (e.kind !== "精读文章" || !e.entry_date) continue;
    const srs = wordSrsOf(e);
    for (const w of wordsOf(e)) {
      total++;
      if (wordGraduated((srs[w.en] ?? []).length)) graduated++;
    }
  }
  return { total, graduated, due: dueWords(entries, today).length };
}

/**
 * 记一个词今天通过，返回该**条目**的 meta 补丁（`wordSrs` 整块替换）。
 * ⚠️ 必须传当前 entry 进来重算，别在外面攒——同一批里可能有同一条目的多个词，
 * 每次都要基于最新的 wordSrs 叠加（调用方按顺序 await 即可）。
 */
export function wordPassPatch(
  e: Entry,
  en: string,
  today: string,
  stats: { wrong: number; rounds: number },
): Record<string, unknown> {
  const srs = wordSrsOf(e);
  const log = srs[en] ?? [];
  if (log.some((r) => r.d === today)) return {};
  return {
    wordSrs: { ...srs, [en]: [...log, { d: today, wrong: stats.wrong, rounds: stats.rounds }] },
  };
}
