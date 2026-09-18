import { useState } from "react";
import { cn } from "@/lib/utils";
import { CARD } from "@/lib/ui";
import { addDays, mondayOf, todayStr } from "@/lib/dates";
import { dayNumOf, matchesDay, type CheckStatus, type PlanItem, type Track } from "./data";

/**
 * 「日程」视图（2026-09-01 加）：**一日全揽**——把一天从早到晚所有时段排成一张竖表，
 * 顶部七天切换、默认落在今天。
 *
 * ⚠️⚠️ **为什么不做成「22 周 × 7 天 × 20 时段 的预排静态表」**（Rosie 转述的那个方案）：
 *   ① 那是**日历式排课**，而这个项目从第一天就刻意拒绝它——PRODUCT.md 的设计取向写着
 *      「用固定流程 + 进度指针」「学完一课才进下一课，不赶日期」「连续性 > 进度速度」，
 *      因为她是**复健期学习者**。预排「第 7 周看第 12 课」，只要她第 3 周慢半课整张表就失真，
 *      然后被无视。她自己踩过同一个模式（复习锚点那次：「我逾期复习就一直放在这吗」）。
 *   ② **作息数据已经存在**（`plan_items` / `SEED_ITEMS`，25 条带 days+time_slot）。
 *      再做一份静态表＝同一份数据两个来源，她改了作息那张表不会跟着变，
 *      直接违反「一个东西只有一个录入口」。
 *   所以这里是**实时从 plan_items 生成**的：改作息，这张表自动跟着变。
 *
 * ⚠️ **两个数据来源，职责分清**：
 *   · `plan_items`（库）＝**要打卡的计划**（养生/英语/学习/运动/阅读），进完成度统计；
 *   · `DAY_FRAME`（下面这个常量）＝**作息骨架**（早餐/通勤/工作/缓冲/午餐…），**不打卡、不进统计**。
 *   为什么骨架不入库：它们没有「做了没做」的语义（通勤总会发生），入库只会把完成度的分母撑大、
 *   把「今日 3/12」变成毫无意义的数字。而**站立办公/眼保健操/肩颈拉伸/午休/打扫卫生
 *   已经在「打卡」模块里**了，这里只标注一下位置，绝不重复建条目。
 */

/** 作息骨架的一段。days 同 plan_items：'*'＝每天，或 '1,2,3,4,5' */
interface FrameSlot {
  days: string;
  from: string;
  to: string;
  label: string;
  /** 这一段的性质，决定配色和是否显示成「背景」 */
  kind: "meal" | "commute" | "work" | "buffer" | "care" | "habit" | "gap" | "study";
  /** 备注，例如「已在打卡页」 */
  note?: string;
}

const WEEKDAYS = "1,2,3,4,5";

/**
 * 作息骨架。⚠️ 这是 Rosie 2026-09-01 给的那张表里**计划条目之外**的部分。
 * 改作息骨架就改这里（跟改 SEED_ITEMS 是同一性质的动作，但**不需要 bump SEED_VERSION**
 * ——它不入库，所以不存在「已播种设备要同步」的问题）。
 */
const DAY_FRAME: FrameSlot[] = [
  { days: "*", from: "06:40", to: "06:50", label: "如厕", kind: "care" },
  { days: "*", from: "07:25", to: "07:30", label: "缓冲", kind: "buffer" },
  { days: "*", from: "07:30", to: "07:50", label: "早餐", kind: "meal" },
  { days: "*", from: "09:40", to: "09:45", label: "缓冲", kind: "buffer" },
  // ——工作日：通勤 + 工作段 + 办公健康——
  { days: WEEKDAYS, from: "09:45", to: "10:15", label: "通勤上班", kind: "commute" },
  { days: WEEKDAYS, from: "10:15", to: "11:00", label: "工作", kind: "work" },
  { days: WEEKDAYS, from: "11:00", to: "11:10", label: "站立办公", kind: "habit", note: "在打卡页勾" },
  { days: WEEKDAYS, from: "11:10", to: "11:15", label: "眼保健操", kind: "habit", note: "在打卡页勾" },
  { days: WEEKDAYS, from: "11:15", to: "11:55", label: "工作", kind: "work" },
  { days: WEEKDAYS, from: "11:55", to: "12:00", label: "收尾", kind: "buffer" },
  { days: WEEKDAYS, from: "12:00", to: "12:30", label: "午餐", kind: "meal" },
  { days: WEEKDAYS, from: "12:30", to: "13:00", label: "空档", kind: "gap" },
  { days: WEEKDAYS, from: "13:00", to: "14:00", label: "日日学", kind: "study", note: "AI + PM 两条主线" },
  { days: WEEKDAYS, from: "14:00", to: "14:45", label: "工作", kind: "work" },
  { days: WEEKDAYS, from: "14:45", to: "14:55", label: "站立办公", kind: "habit", note: "在打卡页勾" },
  { days: WEEKDAYS, from: "14:55", to: "15:40", label: "工作", kind: "work" },
  { days: WEEKDAYS, from: "15:40", to: "15:45", label: "眼保健操", kind: "habit", note: "在打卡页勾" },
  { days: WEEKDAYS, from: "15:45", to: "16:25", label: "工作", kind: "work" },
  { days: WEEKDAYS, from: "16:25", to: "16:35", label: "站立办公", kind: "habit", note: "在打卡页勾" },
  { days: WEEKDAYS, from: "16:35", to: "16:50", label: "颈椎操", kind: "habit", note: "打卡页叫「肩颈拉伸」" },
  { days: WEEKDAYS, from: "16:50", to: "17:30", label: "工作", kind: "work" },
  { days: WEEKDAYS, from: "17:30", to: "17:50", label: "晚餐", kind: "meal" },
  { days: WEEKDAYS, from: "17:50", to: "18:10", label: "通勤回家", kind: "commute" },
  { days: WEEKDAYS, from: "18:10", to: "19:00", label: "空档", kind: "gap" },
  // ——周六：不上班，白天整块给 AI——
  { days: "6", from: "09:40", to: "12:00", label: "AI 学习（周末大块）", kind: "study", note: "省下通勤，9:40 就能开始" },
  { days: "6", from: "12:00", to: "13:00", label: "午餐", kind: "meal" },
  { days: "6", from: "16:00", to: "17:30", label: "AI 学习（续）", kind: "study" },
  { days: "6", from: "17:30", to: "18:10", label: "晚餐", kind: "meal" },
  // ——周日：家务日——
  { days: "7", from: "09:40", to: "12:00", label: "AI 学习（周末大块）", kind: "study" },
  { days: "7", from: "12:00", to: "13:00", label: "午餐", kind: "meal" },
  { days: "7", from: "13:00", to: "15:00", label: "打扫卫生", kind: "habit", note: "在打卡页勾" },
  { days: "7", from: "15:00", to: "17:00", label: "搓澡洗头沐浴", kind: "care" },
  { days: "7", from: "17:00", to: "18:00", label: "全身护肤护发", kind: "care" },
  { days: "7", from: "18:00", to: "18:40", label: "晚餐", kind: "meal" },
];

const KIND_STYLE: Record<FrameSlot["kind"], { bg: string; text: string }> = {
  meal: { bg: "bg-orange-50", text: "text-orange-800"},
  commute: { bg: "bg-slate-50", text: "text-slate-600"},
  work: { bg: "bg-stone-100", text: "text-stone-700"},
  buffer: { bg: "bg-slate-50", text: "text-slate-500"},
  care: { bg: "bg-teal-50", text: "text-teal-700"},
  habit: { bg: "bg-cyan-50", text: "text-cyan-800"},
  gap: { bg: "bg-amber-50", text: "text-amber-700"},
  study: { bg: "bg-violet-50", text: "text-violet-800"},
};

const TRACK_TINT: Record<Track, { bg: string; text: string }> = {
  wellness: { bg: "bg-emerald-50", text: "text-emerald-800" },
  sport: { bg: "bg-lime-50", text: "text-lime-800" },
  english: { bg: "bg-blue-50", text: "text-blue-800" },
  cert: { bg: "bg-violet-50", text: "text-violet-800" },
  ai: { bg: "bg-violet-50", text: "text-violet-800" },
  reading: { bg: "bg-pink-50", text: "text-pink-800" },
};

const DAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function toMin(hhmm: string): number {
  const m = hhmm.match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}
/** 从 plan_items 的 time_slot（"19:00–19:45" / "出门时段"）解析起止；解析不出返回 null */
function parseSlot(s: string | null): { from: number; to: number } | null {
  const m = (s ?? "").match(/(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return {
    from: Number(m[1]) * 60 + Number(m[2]),
    to: Number(m[3]) * 60 + Number(m[4]),
  };
}
function fmt(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

interface Row {
  from: number;
  to: number;
  label: string;
  detail?: string;
  /** 计划条目（要打卡的）才有 */
  item?: PlanItem;
  frameKind?: FrameSlot["kind"];
  note?: string;
}

/** 把某一天的「计划条目 + 作息骨架」并成一张按时间排好的表 */
function buildDay(dayNum: number, items: PlanItem[]): { rows: Row[]; noTime: PlanItem[] } {
  const rows: Row[] = [];
  for (const f of DAY_FRAME) {
    const ok = f.days === "*" || f.days.split(",").includes(String(dayNum));
    if (ok) rows.push({ from: toMin(f.from), to: toMin(f.to), label: f.label, frameKind: f.kind, note: f.note });
  }
  const noTime: PlanItem[] = [];
  for (const it of items) {
    if (!matchesDay(it, dayNum)) continue;
    const p = parseSlot(it.time_slot);
    if (!p) {
      noTime.push(it); // 「出门时段」「到公司后/通勤」这类没有具体钟点的，单独列在表下
      continue;
    }
    rows.push({ from: p.from, to: p.to, label: it.title, detail: it.detail ?? undefined, item: it });
  }
  rows.sort((a, b) => a.from - b.from || a.to - b.to);
  return { rows, noTime };
}

export function Timetable({
  items,
  weekChecks,
}: {
  items: PlanItem[];
  /** 本周各天的打卡状态：key 是日期字符串（复用「一周」视图已经查好的那份，别再查一遍） */
  weekChecks: Record<string, Map<string, CheckStatus>>;
}) {
  const today = todayStr();
  const mon = mondayOf(today);
  const [pick, setPick] = useState<number>(dayNumOf(today)); // 1..7
  const date = addDays(mon, pick - 1);
  const { rows, noTime } = buildDay(pick, items);
  const checks = weekChecks[date];

  // 计划条目的总时长（不含骨架）——用来回答「今天真正安排了多少学习/锻炼」
  const planMin = rows.filter((r) => r.item).reduce((n, r) => n + (r.to - r.from), 0);
  const doneMin = rows
    .filter((r) => r.item && checks?.get(r.item.id) === "done")
    .reduce((n, r) => n + (r.to - r.from), 0);

  return (
    <div className="space-y-4">
      {/* 七天切换，默认落在今天 */}
      <div className="flex flex-wrap gap-2">
        {DAY_NAMES.map((n, i) => {
          const d = i + 1;
          const isToday = dayNumOf(today) === d;
          return (
            <button
              key={n}
              onClick={() => setPick(d)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                pick === d ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
                isToday && pick !== d && "border-primary text-primary",
              )}
            >
              {n}
              {isToday && <span className="ml-1 text-xs opacity-80">今天</span>}
            </button>
          );
        })}
      </div>

      <div className={CARD}>
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-lg font-semibold">{DAY_NAMES[pick - 1]} 全天</h2>
          <span className="text-sm text-muted-foreground">{date}</span>
          <span className="text-xs text-muted-foreground">
            要打卡的计划共 {Math.round(planMin / 60 * 10) / 10} 小时
            {doneMin > 0 && ` · 已完成 ${Math.round(doneMin / 60 * 10) / 10} 小时`}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            浅灰底＝作息骨架（不打卡）· 彩色＝要打卡的计划
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="w-28 border-b border-r px-3 py-2 text-left font-medium">时间</th>
                <th className="w-16 border-b border-r px-2 py-2 text-left font-medium">时长</th>
                <th className="border-b px-3 py-2 text-left font-medium">内容</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const st = r.item ? checks?.get(r.item.id) : undefined;
                const tint = r.item
                  ? TRACK_TINT[r.item.track]
                  : KIND_STYLE[r.frameKind!];
                return (
                  <tr key={`${r.from}-${i}`} className={cn("align-top", tint.bg)}>
                    <td className="border-b border-r px-3 py-2 tabular-nums">
                      {fmt(r.from)}–{fmt(r.to)}
                    </td>
                    <td className="border-b border-r px-2 py-2 tabular-nums text-muted-foreground">
                      {r.to - r.from}′
                    </td>
                    <td className={cn("border-b px-3 py-2", tint.text)}>
                      <span className={cn(r.item && "font-medium", st === "done" && "line-through opacity-60")}>
                        {r.label}
                      </span>
                      {st === "done" && <span className="ml-1.5 text-xs text-emerald-600">✓ 已完成</span>}
                      {st === "skip" && <span className="ml-1.5 text-xs text-amber-600">今天做不了</span>}
                      {r.note && <span className="ml-1.5 text-xs opacity-70">（{r.note}）</span>}
                      {r.detail && (
                        <p className="mt-0.5 line-clamp-2 text-xs opacity-70">{r.detail}</p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {noTime.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs text-muted-foreground">
              没有固定钟点的（时间自由，当天做掉就行）：
            </p>
            <div className="flex flex-wrap gap-2">
              {noTime.map((it) => {
                const st = checks?.get(it.id);
                return (
                  <span
                    key={it.id}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs",
                      TRACK_TINT[it.track].bg,
                      TRACK_TINT[it.track].text,
                      st === "done" && "line-through opacity-60",
                    )}
                  >
                    {it.time_slot ? `${it.time_slot} · ` : ""}
                    {it.title}
                    {st === "done" && " ✓"}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* ⚠️ 这一段是刻意写在界面上的，不只是代码注释——省得哪天又想去做预排的静态表 */}
        <p className="mt-4 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          这张表是<b>实时</b>从时间轴的计划条目生成的——改作息（时间轴的条目或 <code>seed.ts</code>），
          它自动跟着变，不用维护第二份。
          <b>刻意不预排「第几周学第几课」</b>：你是按进度指针走的（学完一课才进下一课、不赶日期），
          预排的日期一旦落后，整张表就会失真然后被无视。每天具体学什么，看日日学和进度笔记。
        </p>
      </div>
    </div>
  );
}
