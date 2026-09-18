import { cn } from "@/lib/utils";
import { addDays, mondayOf, todayStr } from "@/lib/dates";
import { dayNumOf, matchesDay, type CheckStatus, type PlanItem } from "../study-plan/data";
import type { Todo } from "../todo/data";

/**
 * 「日程」＝一周全览，F1 竖排周历（2026-09-19 Rosie 选定）：
 * 七列＝七天、纵向＝时间（06:00–22:30），块的位置＝几点、块的高度＝多长，名字直接写在块里。
 *
 * ⚠️ 2026-09-19 起**没有硬编码的作息骨架了**：骨架＝ plan_items 里 track='frame' 的条目
 * （种子 v25 播入，和其他计划一样可编辑、走同步——Rosie 的要求「都调用同一种模块」）。
 * 改作息直接在这页点块编辑，不用改代码。
 *
 * 今天的「工作」块里同步显示今天的待办（一个时间段＝一段，段里装多个条目——她点名要的，
 * 同时间轴表格版一个思路）。待办在这里只读，增删改去待办模块。
 *
 * 颜色（2026-09-19 Rosie 二调，三档浅蓝、英语并入学习色）：
 * 中浅蓝 #85B7EB＝学习（AI+英语）· 浅蓝 #B5D4F4＝运动养生 · 最浅蓝 #E6F1FB＝作息骨架。
 * ⚠️ 她点名不要深蓝（#378ADD 那档已撤），别加回来。
 */

const DAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const AXIS_START = 360; // 06:00
const AXIS_END = 1350; // 22:30
const PX_PER_MIN = 0.8; // 一分钟几像素：0.8 ⇒ 全天约 792px；晨间养生合并块（30–35min）能放下两行名字

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
  /** 待办条目专用：完成态直接来自 todos 表，不走 plan_checks */
  todoDone?: boolean;
}
interface Block {
  from: number;
  to: number;
  kind: "frame" | "study" | "plan";
  parts: Part[];
}

/** 列太窄放不下长标题：砍掉括号里的说明（「英语（新概念整块：…）」→「英语」），悬停看全称。
 *  短标题不砍——「八段锦（武当版）」的版本信息她要看（09-19 的示意图里写着两版并列）。 */
function shortTitle(t: string): string {
  return t.length <= 10 ? t : t.replace(/[（(].*$/, "");
}

function buildDay(dayNum: number, items: PlanItem[], todosForDay: Todo[]): { blocks: Block[]; noTime: PlanItem[] } {
  const blocks: Block[] = [];
  const noTime: PlanItem[] = [];
  const plans: Block[] = [];
  for (const it of items) {
    if (!matchesDay(it, dayNum)) continue;
    const p = parseSlot(it.time_slot);
    if (!p) {
      if (it.track !== "frame") noTime.push(it);
      continue;
    }
    const kind =
      it.track === "frame" ? "frame" : it.track === "ai" || it.track === "cert" || it.track === "english" ? "study" : "plan";
    const block: Block = { ...p, kind, parts: [{ label: shortTitle(it.title), item: it }] };
    if (kind === "frame") blocks.push(block);
    else plans.push(block);
  }
  // 今天的待办装进第一个「工作」块——一个时间段＝一段，段里装多个条目（Rosie 要的联动）
  const work = blocks.find((b) => b.parts[0]?.label === "工作");
  if (work) work.parts.push(...todosForDay.map((t) => ({ label: t.title, todoDone: t.done === 1 })));

  plans.sort((a, b) => a.from - b.from || a.to - b.to);
  /** ⚠️ 挨着的（间隔≤10min，含同时段重叠的泡脚+阅读）「其他计划」合并成一个块、块内一项一行。
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
  study: "bg-[#85B7EB] text-[#042C53]",
  plan: "bg-[#B5D4F4] text-[#0C447C]",
  // 骨架＝最浅蓝。⚠️ 它铺在白色列上，不描边就快看不见了——border 别删
  frame: "bg-[#E6F1FB] text-[#5D8AB8] border border-[#C9DEF3]",
};

export function Timetable({
  items,
  weekChecks,
  todayTodos,
  onSelect,
}: {
  items: PlanItem[];
  weekChecks: Record<string, Map<string, CheckStatus>>;
  todayTodos: Todo[];
  /** 点一个块 ⇒ 把块里的计划条目交给日程页的编辑区（待办条目不在内，去待办模块改） */
  onSelect: (items: PlanItem[]) => void;
}) {
  const today = todayStr();
  const mon = mondayOf(today);
  const todayNum = dayNumOf(today);
  const hourMarks = [420, 540, 660, 780, 900, 1020, 1140, 1260]; // 07:00–21:00 每两小时

  const days = DAY_NAMES.map((name, i) => {
    const dayNum = i + 1;
    const date = addDays(mon, i);
    return {
      name,
      dayNum,
      date,
      ...buildDay(dayNum, items, dayNum === todayNum ? todayTodos : []),
      checks: weekChecks[date],
    };
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
              d.dayNum === todayNum && "bg-[#F3F8FE]",
            )}
          >
            {d.blocks.map((b, k) => {
              const h = Math.max(8, y(b.to) - y(b.from));
              const stOf = (p: Part) => (p.item ? d.checks?.get(p.item.id) : undefined);
              const allDone =
                b.parts.some((p) => p.item) && b.parts.every((p) => !p.item || stOf(p) === "done");
              const tip =
                `${fmt(b.from)}–${fmt(b.to)} ` +
                b.parts
                  .map((p) => (p.item?.title ?? p.label) + (stOf(p) === "skip" ? "（今天做不了）" : ""))
                  .join(" / ") +
                " · 点击编辑";
              const editable = b.parts.filter((p) => p.item).map((p) => p.item!);
              return (
                <div
                  key={k}
                  title={tip}
                  onClick={() => editable.length > 0 && onSelect(editable)}
                  className={cn(
                    "absolute inset-x-0.5 cursor-pointer overflow-hidden rounded-lg px-1.5 py-[1px] text-[11.5px] leading-[1.25]",
                    BLOCK_STYLE[b.kind],
                    allDone && "opacity-60",
                  )}
                  style={{ top: y(b.from), height: h }}
                >
                  {/* 一项一行（2026-09-19 Rosie：「区块里的每一项都单开一行」）；放不下的行被
                      overflow 裁掉，悬停 tooltip 里有全部 */}
                  {h >= 14 &&
                    b.parts.map((p, j) => {
                      const st = stOf(p);
                      const done = st === "done" || p.todoDone;
                      return (
                        <div
                          key={j}
                          className={cn(
                            "truncate",
                            done && "opacity-70",
                            st === "skip" && "line-through opacity-60",
                          )}
                        >
                          {done && "✓"}
                          {p.label}
                        </div>
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
                  onClick={() => onSelect([it])}
                  className={cn(
                    "cursor-pointer truncate rounded-lg border border-dashed border-[#B5D4F4] px-1.5 py-0.5 text-[11px] text-[#185FA5]",
                    d.checks?.get(it.id) === "done" && "line-through opacity-55",
                  )}
                  title={`${it.title} · 点击编辑`}
                >
                  {shortTitle(it.title)}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <p className="pt-3 text-xs text-muted-foreground">
        中浅蓝＝学习（AI/英语）· 浅蓝＝运动养生 · 最浅蓝＝作息骨架（不打卡）。
        块高＝时长；挨着的短条目合并成一块、块内一项一行；今天的「工作」块里带今天的待办（✓＝已完成）。
        <b>点任意块可直接编辑</b>（改名/改时间/删除），待办去待办模块改。
      </p>
    </div>
  );
}
