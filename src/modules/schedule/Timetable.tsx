import { cn } from "@/lib/utils";
import { addDays, mondayOf, todayStr } from "@/lib/dates";
import { dayNumOf, matchesDay, type CheckStatus, type PlanItem } from "../study-plan/data";

/**
 * 「日程」＝一周全览，F1 竖排周历（2026-09-19 Rosie 选定，替换只用了一天的 D5 泳道）：
 * 七列＝七天、纵向＝时间（06:00–22:30），块的位置＝几点、块的高度＝多长，
 * 名字直接写在块里——D5 被否的原因就是块里看不清字、还得点开才知道是什么。
 *
 * ⚠️ 没有单日明细视图——她 09-18 指出跟时间轴的「今天」功能重合。这页只做周视角。
 *
 * 颜色（白底＋深浅蓝，她点名主色要比设计稿的 #185FA5 浅，所以最深一档用 #378ADD）：
 * · #378ADD ＝ AI 学习（主线最深）· #85B7EB ＝ 英语 · #B5D4F4 ＝ 其他计划
 * · 灰白 ＝ 作息骨架（吃饭/通勤/工作），退到背景，不打卡。
 *
 * ⚠️ 数据来源不变：plan_items + DAY_FRAME。改作息去时间轴/seed.ts，这里自动跟着变。
 */

interface FrameSlot {
  days: string;
  from: string;
  to: string;
  label: string;
}

const WEEKDAYS = "1,2,3,4,5";

/** 作息骨架（不打卡、不进统计）。改骨架就改这里。 */
const DAY_FRAME: FrameSlot[] = [
  { days: "*", from: "06:40", to: "06:50", label: "如厕" },
  { days: "*", from: "07:25", to: "07:30", label: "缓冲" },
  { days: "*", from: "07:30", to: "07:50", label: "早餐" },
  { days: "*", from: "09:40", to: "09:45", label: "缓冲" },
  { days: WEEKDAYS, from: "09:45", to: "10:15", label: "通勤" },
  { days: WEEKDAYS, from: "10:15", to: "12:00", label: "工作" },
  { days: WEEKDAYS, from: "12:00", to: "12:30", label: "午餐" },
  { days: WEEKDAYS, from: "12:30", to: "13:00", label: "空档" },
  { days: WEEKDAYS, from: "13:00", to: "14:00", label: "日日学" },
  { days: WEEKDAYS, from: "14:00", to: "17:30", label: "工作" },
  { days: WEEKDAYS, from: "17:30", to: "17:50", label: "晚餐" },
  { days: WEEKDAYS, from: "17:50", to: "18:10", label: "通勤" },
  { days: WEEKDAYS, from: "18:10", to: "19:00", label: "空档" },
  { days: "6,7", from: "12:00", to: "13:00", label: "午餐" },
  { days: "6", from: "18:00", to: "18:40", label: "晚餐" },
  { days: "7", from: "13:00", to: "15:00", label: "打扫卫生" },
  { days: "7", from: "15:00", to: "17:00", label: "搓澡洗头沐浴" },
  { days: "7", from: "17:00", to: "18:00", label: "全身护肤护发" },
  { days: "7", from: "18:00", to: "18:40", label: "晚餐" },
];

const DAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const AXIS_START = 360; // 06:00
const AXIS_END = 1350; // 22:30
const PX_PER_MIN = 0.8; // 一分钟几像素：0.8 ⇒ 全天约 792px；晨间养生合并块（30–35min）能放下两行名字

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
const y = (min: number) => (min - AXIS_START) * PX_PER_MIN;
const AXIS_H = y(AXIS_END);

interface Part {
  label: string;
  item?: PlanItem;
}
interface Block {
  from: number;
  to: number;
  kind: "frame" | "study" | "english" | "plan";
  parts: Part[];
}

/** 列太窄放不下长标题：砍掉括号里的说明（「英语（新概念整块：…）」→「英语」），悬停看全称 */
function shortTitle(t: string): string {
  return t.replace(/[（(].*$/, "");
}

function buildDay(dayNum: number, items: PlanItem[]): { blocks: Block[]; noTime: PlanItem[] } {
  const blocks: Block[] = [];
  for (const f of DAY_FRAME) {
    if (f.days !== "*" && !f.days.split(",").includes(String(dayNum))) continue;
    blocks.push({ from: toMin(f.from), to: toMin(f.to), kind: "frame", parts: [{ label: f.label }] });
  }
  const noTime: PlanItem[] = [];
  const plans: Block[] = [];
  for (const it of items) {
    if (!matchesDay(it, dayNum)) continue;
    const p = parseSlot(it.time_slot);
    if (!p) {
      noTime.push(it);
      continue;
    }
    const kind = it.track === "ai" || it.track === "cert" ? "study" : it.track === "english" ? "english" : "plan";
    plans.push({ ...p, kind, parts: [{ label: shortTitle(it.title), item: it }] });
  }
  plans.sort((a, b) => a.from - b.from || a.to - b.to);
  /** ⚠️ 挨着的（间隔≤10min，含同时段重叠的泡脚+阅读）「其他计划」合并成一个块、名字用 · 连写。
   *  不合并的话晨间养生全是 10–20 分钟的矮条，字放不下——就是 09-19 Rosie 问
   *  「五脏逼毒八段锦咋没了」的原因：块在，字被藏了。学习/英语块时长够，不参与合并。 */
  for (const b of plans) {
    const prev = blocks[blocks.length - 1];
    if (prev && prev.kind === "plan" && b.kind === "plan" && b.from <= prev.to + 10) {
      prev.to = Math.max(prev.to, b.to);
      prev.parts.push(...b.parts);
    } else {
      blocks.push(b);
    }
  }
  // 骨架先画、计划后画：偶有重叠时计划块盖在骨架上面（DOM 顺序即层级）
  blocks.sort((a, b) => (a.kind === "frame" ? 0 : 1) - (b.kind === "frame" ? 0 : 1) || a.from - b.from);
  return { blocks, noTime };
}

const BLOCK_STYLE: Record<Block["kind"], string> = {
  study: "bg-[#378ADD] text-[#E6F1FB]",
  english: "bg-[#85B7EB] text-[#042C53]",
  plan: "bg-[#B5D4F4] text-[#0C447C]",
  frame: "bg-[#F1F3F6] text-[#93A0AF]",
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
  const hourMarks = [420, 540, 660, 780, 900, 1020, 1140, 1260]; // 07:00–21:00 每两小时

  const days = DAY_NAMES.map((name, i) => {
    const dayNum = i + 1;
    const date = addDays(mon, i);
    return { name, dayNum, date, ...buildDay(dayNum, items), checks: weekChecks[date] };
  });

  return (
    <div>
      {/* 表头：星期 + 日期，今天高亮 */}
      <div className="flex">
        <div className="w-11 shrink-0" />
        {days.map((d) => (
          <div key={d.dayNum} className="min-w-0 flex-1 px-0.5 pb-2 text-center">
            <span
              className={cn(
                "inline-block rounded-full px-2.5 py-1 text-[13px] font-medium",
                d.dayNum === todayNum ? "bg-primary text-primary-foreground" : "text-foreground",
              )}
            >
              {d.name}
            </span>
            <div className="text-[11px] text-muted-foreground">{d.date.slice(5).replace("-", "/")}</div>
          </div>
        ))}
      </div>

      {/* 周历主体：左时间轴 + 七列 */}
      <div className="relative flex" style={{ height: AXIS_H }}>
        {hourMarks.map((h) => (
          <div
            key={h}
            className="pointer-events-none absolute left-11 right-0 border-t border-border/60"
            style={{ top: y(h) }}
          />
        ))}
        <div className="relative w-11 shrink-0">
          {hourMarks.map((h) => (
            <span
              key={h}
              className="absolute right-2 text-[11px] tabular-nums text-muted-foreground"
              style={{ top: y(h) - 8 }}
            >
              {fmt(h)}
            </span>
          ))}
        </div>
        {days.map((d) => (
          <div
            key={d.dayNum}
            className={cn(
              "relative min-w-0 flex-1 border-l border-border/60",
              d.dayNum === todayNum && "bg-[#EFF6FD]",
            )}
          >
            {d.blocks.map((b, k) => {
              const h = Math.max(8, y(b.to) - y(b.from));
              const stOf = (p: Part) => (p.item ? d.checks?.get(p.item.id) : undefined);
              const allDone = b.parts.every((p) => !p.item || stOf(p) === "done");
              const tip =
                `${fmt(b.from)}–${fmt(b.to)} ` +
                b.parts
                  .map((p) => (p.item?.title ?? p.label) + (stOf(p) === "skip" ? "（今天做不了）" : ""))
                  .join(" / ");
              return (
                <div
                  key={k}
                  title={tip}
                  className={cn(
                    "absolute inset-x-0.5 overflow-hidden rounded-lg px-1.5 py-[1px] text-[11.5px] leading-[1.25]",
                    BLOCK_STYLE[b.kind],
                    b.parts.some((p) => p.item) && allDone && "opacity-60",
                  )}
                  style={{ top: y(b.from), height: h }}
                >
                  {h >= 14 &&
                    b.parts.map((p, j) => {
                      const st = stOf(p);
                      return (
                        <span key={j}>
                          {j > 0 && " · "}
                          <span className={cn(st === "done" && "opacity-70", st === "skip" && "line-through opacity-60")}>
                            {st === "done" && "✓"}
                            {p.label}
                          </span>
                        </span>
                      );
                    })}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* 没写钟点的计划（少见）：挂在对应列底下 */}
      {days.some((d) => d.noTime.length > 0) && (
        <div className="flex pt-2">
          <div className="w-11 shrink-0" />
          {days.map((d) => (
            <div key={d.dayNum} className="min-w-0 flex-1 space-y-1 px-0.5">
              {d.noTime.map((it) => (
                <div
                  key={it.id}
                  className={cn(
                    "truncate rounded-lg border border-dashed border-[#B5D4F4] px-1.5 py-0.5 text-[11px] text-[#185FA5]",
                    d.checks?.get(it.id) === "done" && "line-through opacity-55",
                  )}
                  title={it.title}
                >
                  {shortTitle(it.title)}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <p className="pt-3 text-xs text-muted-foreground">
        深蓝＝AI 学习 · 中蓝＝英语 · 浅蓝＝其他计划 · 灰白＝作息骨架（不打卡）。
        块高＝时长；挨着的短条目（晨间养生、腰椎+运动）合并成一块、名字用 · 连写，悬停看全称和各自时间。
        这张表实时来自时间轴的计划——改作息去时间轴改。
      </p>
    </div>
  );
}
