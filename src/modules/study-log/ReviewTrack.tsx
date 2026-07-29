import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatDateCn, todayStr } from "@/lib/dates";
import type { Entry } from "./data";
import {
  REVIEW_GAPS,
  isGraduated,
  isReviewable,
  nextDue,
  overdueDays,
  reviewLog,
  reviewSteps,
  type RevRecord,
} from "./review";

/**
 * 复习记录组件（2026-07-28）。
 *
 * 来自 Rosie 自己写的用户故事：「我想看到每首诗历次复习的日期，
 * 以便判断是真记牢了、还是每次都在重新背」——她那条故事挖出的缺口是：
 * 历次通过日期一直存在 `meta.revs` 里，但界面上只显示「第 N/5 次」，
 * **数据有、看不到**。
 *
 * 所以这里把完整曲线摊开：五次复习画成五格（每格标「距上次几天」），
 * 已通过的显示日期 + 那次默得难不难，没到的显示计划日期。
 * 「难不难」＝第一遍错几句 / 默了几轮，只有日期是答不了她那个问题的。
 */

/** 一次复习难不难，翻成人话 */
function hardness(r: RevRecord): { text: string; tone: "good" | "mid" | "hard" | "unknown" } {
  if (r.wrong === undefined) return { text: "无记录", tone: "unknown" };
  if (r.wrong === 0) return { text: "一遍过", tone: "good" };
  const rounds = r.rounds ?? 1;
  return {
    text: `错 ${r.wrong} 句 · ${rounds} 轮`,
    tone: r.wrong <= 2 ? "mid" : "hard",
  };
}

const TONE_CLS: Record<string, string> = {
  good: "text-emerald-600",
  mid: "text-amber-600",
  hard: "text-red-500",
  unknown: "text-muted-foreground",
};

/** 五格曲线 + 可展开的明细。`compact` 时只画格子、不显示标题行 */
export function ReviewTrack({
  entry,
  accent,
  compact = false,
}: {
  entry: Entry;
  accent: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const today = todayStr();

  if (!isReviewable(entry)) return null;

  const log = reviewLog(entry);
  const steps = reviewSteps(entry, today);
  const grad = isGraduated(entry);
  const due = nextDue(entry);
  const over = overdueDays(entry, today);
  const passedToday = log.some((r) => r.d === today);
  // 「一遍过」的次数——判断「真记牢了还是每次重新背」最直接的一个数
  const clean = log.filter((r) => r.wrong === 0).length;
  const withStats = log.filter((r) => r.wrong !== undefined).length;

  return (
    <div className="mt-2">
      {!compact && (
        <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="font-medium text-foreground">复习曲线</span>
          <span className="text-muted-foreground">
            已通过 {log.length}/{REVIEW_GAPS.length} 次
          </span>
          {withStats > 0 && (
            <span className="text-muted-foreground">
              其中 <b className={clean === withStats ? "text-emerald-600" : "text-foreground"}>{clean}</b> 次一遍过
            </span>
          )}
          {grad ? (
            <span className="text-emerald-600">· 五次走完，记牢了</span>
          ) : due ? (
            <span className={over > 0 ? "text-amber-600" : "text-muted-foreground"}>
              · {over > 0 && !passedToday ? `晚了 ${over} 天（本该 ${formatDateCn(due)}）` : `下次 ${formatDateCn(due)}`}
            </span>
          ) : null}
          {log.length > 0 && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="ml-auto text-primary hover:underline"
            >
              {open ? "收起明细" : "看明细"}
            </button>
          )}
        </div>
      )}

      {/* 五格：已通过=实色，今天到期=描边+脉冲色，未到=虚线 */}
      <div className="flex items-stretch gap-1">
        {steps.map((s) => {
          const isPassed = s.state === "passed";
          const isDue = s.state === "due";
          return (
            <div
              key={s.n}
              className={cn(
                "flex-1 rounded-md px-1.5 py-1 text-center",
                isPassed ? "text-white" : isDue ? "border" : "border border-dashed",
              )}
              style={
                isPassed
                  ? { background: accent }
                  : isDue
                    ? { borderColor: accent, background: accent + "18", color: accent }
                    : { borderColor: "var(--color-border)" }
              }
              title={
                isPassed
                  ? `第 ${s.n} 次 · ${s.date} · ${hardness(s.rec!).text}`
                  : `第 ${s.n} 次 · 计划 ${s.date ?? "—"}（上次之后 ${s.gap} 天）`
              }
            >
              {/* 标的是「距上次复习几天」——排程锚在上一次实际复习上，
                  写成「学完后第 N 天」会跟真实日期对不上（见 review.ts 的 REVIEW_GAPS） */}
              <div className="text-[10px] leading-tight opacity-80">
                {isPassed ? `第${s.n}次` : `+${s.gap}天`}
              </div>
              <div className="text-[11px] font-medium leading-tight tabular-nums">
                {isPassed ? s.date!.slice(5).replace("-", "/") : isDue ? "今天" : s.date?.slice(5).replace("-", "/") ?? "—"}
              </div>
            </div>
          );
        })}
      </div>

      {open && log.length > 0 && (
        <div className="mt-2 space-y-1 rounded-md border bg-muted/30 p-2">
          {log.map((r, i) => {
            const h = hardness(r);
            return (
              <div key={r.d + i} className="flex items-center gap-2 text-xs">
                <span className="w-10 shrink-0 text-muted-foreground">第 {i + 1} 次</span>
                <span className="tabular-nums">{formatDateCn(r.d)}</span>
                <span className={cn("ml-auto", TONE_CLS[h.tone])}>{h.text}</span>
              </div>
            );
          })}
          {clean === withStats && withStats >= 2 && (
            <p className="pt-1 text-[11px] text-emerald-700">
              连着 {withStats} 次都是一遍过——这首是真记住了，不是每次重新背。
            </p>
          )}
          {withStats > 0 && clean === 0 && (
            <p className="pt-1 text-[11px] text-amber-700">
              每次都要订正才过，说明还没进长期记忆——别急，间隔本来就是干这个的。
            </p>
          )}
          {withStats < log.length && (
            <p className="pt-1 text-[11px] text-muted-foreground">
              「无记录」的是 2026-07-28 之前通过的，那时还没记难度。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
