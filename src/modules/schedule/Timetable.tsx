import { useState } from "react";
import { cn } from "@/lib/utils";
import { addDays, mondayOf, todayStr } from "@/lib/dates";
import { dayNumOf, matchesDay, type CheckStatus, type PlanItem } from "../study-plan/data";

/**
 * 「日程」＝一周全览，D5 圆条泳道（2026-09-18 Rosie 选定）：
 * 每天一行，时间从左到右（06:00–22:30），块宽＝时长、全部圆头；
 * 点某一行展开那天的条目明细（D5 的已知取舍：泳道块里放不下条目名，明细靠展开）。
 *
 * ⚠️ 单日明细表已删——她指出跟时间轴的「今天」功能重合。这页只做周视角。
 *
 * 颜色（只此青绿，两阶 + 白）：
 * · 深绿 #1D9E75 ＝ 学习类计划（ai/cert）——这是她现在的主线，最深；
 * · 浅绿 #9FE1CB ＝ 其他要打卡的计划（养生/运动/英语/阅读）；
 * · 白 ＝ 作息骨架（吃饭/通勤/工作/家务），退到背景。
 *
 * ⚠️ 数据来源不变：plan_items + DAY_FRAME。改作息去时间轴/seed.ts，这里自动跟着变。
 */

interface FrameSlot {
  days: string;
  from: string;
  to: string;
  label: string;
  kind: "meal" | "commute" | "work" | "buffer" | "care" | "habit" | "gap" | "study";
  note?: string;
}

const WEEKDAYS = "1,2,3,4,5";

/** 作息骨架（不打卡、不进统计；打卡类的已在打卡模块，这里只标注）。改骨架就改这里。 */
const DAY_FRAME: FrameSlot[] = [
  { days: "*", from: "06:40", to: "06:50", label: "如厕", kind: "care" },
  { days: "*", from: "07:25", to: "07:30", label: "缓冲", kind: "buffer" },
  { days: "*", from: "07:30", to: "07:50", label: "早餐", kind: "meal" },
  { days: "*", from: "09:40", to: "09:45", label: "缓冲", kind: "buffer" },
  { days: WEEKDAYS, from: "09:45", to: "10:15", label: "通勤上班", kind: "commute" },
  { days: WEEKDAYS, from: "10:15", to: "12:00", label: "工作", kind: "work", note: "站立/眼操在打卡页" },
  { days: WEEKDAYS, from: "12:00", to: "12:30", label: "午餐", kind: "meal" },
  { days: WEEKDAYS, from: "12:30", to: "13:00", label: "空档", kind: "gap" },
  { days: WEEKDAYS, from: "13:00", to: "14:00", label: "日日学", kind: "study", note: "AI + PM 主线" },
  { days: WEEKDAYS, from: "14:00", to: "17:30", label: "工作", kind: "work", note: "站立/眼操/颈椎操在打卡页" },
  { days: WEEKDAYS, from: "17:30", to: "17:50", label: "晚餐", kind: "meal" },
  { days: WEEKDAYS, from: "17:50", to: "18:10", label: "通勤回家", kind: "commute" },
  { days: WEEKDAYS, from: "18:10", to: "19:00", label: "空档", kind: "gap" },
  { days: "6,7", from: "12:00", to: "13:00", label: "午餐", kind: "meal" },
  { days: "6", from: "18:00", to: "18:40", label: "晚餐", kind: "meal" },
  { days: "7", from: "13:00", to: "15:00", label: "打扫卫生", kind: "habit", note: "在打卡页勾" },
  { days: "7", from: "15:00", to: "17:00", label: "搓澡洗头沐浴", kind: "care" },
  { days: "7", from: "17:00", to: "18:00", label: "全身护肤护发", kind: "care" },
  { days: "7", from: "18:00", to: "18:40", label: "晚餐", kind: "meal" },
];

const DAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const AXIS_START = 360; // 06:00
const AXIS_END = 1350; // 22:30

function toMin(hhmm: string): number {
  const m = hhmm.match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}
function parseSlot(s: string | null): { from: number; to: number } | null {
  const m = (s ?? "").match(/(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { from: Number(m[1]) * 60 + Number(m[2]), to: Number(m[3]) * 60 + Number(m[4]) };
}
function fmt(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

interface Seg {
  from: number;
  to: number;
  label: string;
  /** gap＝透明占位；frame＝白块；plan＝浅绿；study＝深绿 */
  kind: "gap" | "frame" | "plan" | "study";
  item?: PlanItem;
}

/** 把一天铺成从 AXIS_START 到 AXIS_END 的连续段：块之间的空隙补透明 gap。
 *  ⚠️ 连续的骨架块合并成一段（标签取最长的那个）——泳道里 5 分钟的「缓冲」
 *  一个个画出来只剩碎渣，合并后骨架是一条安静的白带。计划条目**不合并**。 */
function buildLane(dayNum: number, items: PlanItem[]): { segs: Seg[]; noTime: PlanItem[] } {
  const blocks: Seg[] = [];
  for (const f of DAY_FRAME) {
    if (f.days !== "*" && !f.days.split(",").includes(String(dayNum))) continue;
    blocks.push({ from: toMin(f.from), to: toMin(f.to), label: f.label, kind: "frame" });
  }
  const noTime: PlanItem[] = [];
  for (const it of items) {
    if (!matchesDay(it, dayNum)) continue;
    const p = parseSlot(it.time_slot);
    if (!p) {
      noTime.push(it);
      continue;
    }
    blocks.push({
      ...p,
      label: it.title,
      kind: it.track === "ai" || it.track === "cert" ? "study" : "plan",
      item: it,
    });
  }
  blocks.sort((a, b) => a.from - b.from || a.to - b.to);

  const segs: Seg[] = [];
  let cursor = AXIS_START;
  for (const b of blocks) {
    if (b.from > cursor) segs.push({ from: cursor, to: b.from, label: "", kind: "gap" });
    const prev = segs[segs.length - 1];
    if (b.kind === "frame" && prev && prev.kind === "frame" && b.from <= prev.to + 1) {
      // 合并连续骨架；标签留时长最长的那段
      if (b.to - b.from > prev.to - prev.from) prev.label = b.label;
      prev.to = Math.max(prev.to, b.to);
    } else {
      segs.push({ ...b });
    }
    cursor = Math.max(cursor, b.to);
  }
  if (cursor < AXIS_END) segs.push({ from: cursor, to: AXIS_END, label: "", kind: "gap" });
  return { segs, noTime };
}

const SEG_STYLE: Record<Exclude<Seg["kind"], "gap">, string> = {
  study: "bg-[#1D9E75] text-[#E1F5EE]",
  plan: "bg-[#9FE1CB] text-[#04342C]",
  frame: "bg-card text-[#7FA294]",
};

export function Timetable({
  items,
  weekChecks,
}: {
  items: PlanItem[];
  weekChecks: Record<string, Map<string, CheckStatus>>;
}) {
  const today = todayStr();
  const mon = mondayOf(today);
  const todayNum = dayNumOf(today);
  const [open, setOpen] = useState<number | null>(todayNum); // 展开明细的那天，默认今天

  const hours = [360, 480, 600, 720, 840, 960, 1080, 1200, 1320];

  return (
    <div className="space-y-3">
      {/* 时间刻度 */}
      <div className="flex pl-[72px] pr-1 text-[11px] text-muted-foreground">
        {hours.map((h, i) => (
          <span key={h} style={{ flex: i === hours.length - 1 ? 0 : 1 }}>
            {fmt(h)}
          </span>
        ))}
      </div>

      {DAY_NAMES.map((name, i) => {
        const d = i + 1;
        const date = addDays(mon, i);
        const isToday = d === todayNum;
        const { segs, noTime } = buildLane(d, items);
        const checks = weekChecks[date];
        const expanded = open === d;
        const planSegs = segs.filter((s) => s.item);
        return (
          <div key={name}>
            <button
              onClick={() => setOpen(expanded ? null : d)}
              className="flex w-full items-center gap-3 text-left"
              title="点击展开这一天的明细"
            >
              <span
                className={cn(
                  "w-[60px] shrink-0 rounded-full py-1.5 text-center text-[13px] font-medium",
                  isToday ? "bg-primary text-primary-foreground" : "bg-card text-foreground",
                )}
              >
                {name}
              </span>
              <span className="flex h-9 min-w-0 flex-1 gap-[3px]">
                {segs.map((s, k) => {
                  const dur = s.to - s.from;
                  if (s.kind === "gap") return <span key={k} style={{ flexGrow: dur }} />;
                  const done = s.item && checks?.get(s.item.id) === "done";
                  return (
                    <span
                      key={k}
                      title={`${fmt(s.from)}–${fmt(s.to)} ${s.label}`}
                      className={cn(
                        "flex items-center justify-center overflow-hidden whitespace-nowrap rounded-full px-2 text-[12px]",
                        SEG_STYLE[s.kind],
                        done && "opacity-55",
                      )}
                      style={{ flexGrow: dur, flexBasis: 0, minWidth: s.kind === "frame" ? 8 : 14 }}
                    >
                      {dur >= 45 ? (
                        <>
                          {s.label.length > 9 ? s.label.slice(0, 9) + "…" : s.label}
                          {done && " ✓"}
                        </>
                      ) : null}
                    </span>
                  );
                })}
              </span>
            </button>

            {expanded && (
              <div className="ml-[72px] mt-2 flex flex-wrap gap-2">
                {planSegs.map((s) => {
                  const st = s.item && checks?.get(s.item.id);
                  return (
                    <span
                      key={s.item!.id}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-[13px]",
                        s.kind === "study" ? "bg-[#E1F5EE] text-[#04342C]" : "bg-card text-[#085041]",
                        st === "done" && "line-through opacity-55",
                      )}
                    >
                      <span className="tabular-nums opacity-70">{fmt(s.from)}</span> {s.item!.title}
                      {st === "done" && " ✓"}
                      {st === "skip" && <span className="text-amber-700">（今天做不了）</span>}
                    </span>
                  );
                })}
                {noTime.map((it) => (
                  <span
                    key={it.id}
                    className={cn(
                      "rounded-full border border-dashed border-[#9FE1CB] px-3 py-1.5 text-[13px] text-[#0F6E56]",
                      checks?.get(it.id) === "done" && "line-through opacity-55",
                    )}
                  >
                    {it.time_slot ? `${it.time_slot} · ` : ""}
                    {it.title}
                    {checks?.get(it.id) === "done" && " ✓"}
                  </span>
                ))}
                {planSegs.length === 0 && noTime.length === 0 && (
                  <span className="text-[13px] text-muted-foreground">这天没有要打卡的计划</span>
                )}
              </div>
            )}
          </div>
        );
      })}

      <p className="pl-[72px] text-xs text-muted-foreground">
        深绿＝学习 · 浅绿＝其他计划 · 白＝作息骨架（不打卡）。点某一行展开当天明细。
        这张表实时来自时间轴的计划——改作息去时间轴改。
      </p>
    </div>
  );
}
