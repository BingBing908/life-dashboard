import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CARD } from "@/lib/ui";
import { addDays, mondayOf, todayStr } from "@/lib/dates";
import {
  dayNumOf,
  getPeriodOn,
  listCheckStatus,
  listItems,
  matchesDay,
  setPeriodOn,
} from "@/modules/study-plan/data";
import { listTodos } from "@/modules/todo/data";
import { dayCalories, getCalTarget, getMeals, getWeightLog, setWeightEntry, type DayWeight } from "@/modules/supplement/data";
import { getCheckins, habitOnDay, listHabits } from "@/modules/habit-checkin/data";
import { listAllEntries } from "@/modules/study-log/data";
import { entryDone } from "@/modules/study-log";

interface Props {
  onOpenModule: (id: string) => void;
}

interface Bar { done: number; total: number; isToday: boolean }
interface Stats {
  plan: { done: number; total: number };
  todo: { done: number; total: number; all: number };
  cal: { eaten: number; target: number; dinner: number };
  habit: { done: number; total: number };
  learn: { done: number; total: number };
  bars: (Bar | null)[];
}

const DAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

/** 总览：今日各模块完成度（顶排，点进对应模块）+ 本周时间轴完成柱 + 最近七天体重趋势。
 *  2026-07-28 去掉了下面那排模块入口摘要卡（跟侧栏重复）。 */
const WEIGHT_GOAL = 58; // 12/27 减重验收目标（kg）

export function DashboardShell({ onOpenModule }: Props) {
  const [periodOn, setPeriodState] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [weightLog, setWeightLog] = useState<Record<string, DayWeight>>({});
  const today = todayStr();
  const yesterday = addDays(today, -1);
  // 两格：前晚睡前（**昨天**的 pm）· 今晨空腹（今天的 am），跟饮食页同一个口径
  // （2026-07-29 Rosie 要求统一）。这两个数的差＝一夜的变化。
  // ⚠️ 故意不做「今晚睡前」那一格：她睡前不开界面，睡前体重本来就是**第二天早上
  // 当「前晚」一起补**的。所以两格就够，加第三格反而是多余的入口。
  const [wLastPm, setWLastPm] = useState("");
  const [wAm, setWAm] = useState("");

  useEffect(() => {
    getPeriodOn().then(setPeriodState).catch(() => {});
    getWeightLog().then((w) => {
      setWeightLog(w);
      setWLastPm(w[yesterday]?.pm != null ? String(w[yesterday].pm) : "");
      setWAm(w[today]?.am != null ? String(w[today].am) : "");
    }).catch(() => {});
    (async () => {
      const today = todayStr();
      const tNum = dayNumOf(today);
      const [items, todos, meals, calTarget, eaten, habits, checkins, entries] = await Promise.all([
        listItems(),
        listTodos(),
        getMeals(today),
        getCalTarget(),
        dayCalories(today),
        listHabits(),
        getCheckins(8),
        listAllEntries(),
      ]);
      const todayCheck = await listCheckStatus(today);
      const todayPlan = items.filter((i) => matchesDay(i, tNum));
      const planDone = todayPlan.filter((i) => todayCheck.get(i.id) === "done").length;

      // ⚠️ 顶排的「待办」只数**今天该做的**（标了今天、或过期没做的），不是全部待办；
      // 全部条数放在副标题里，免得跟待办页看到的总数对不上（2026-07-28 Rosie 反馈）。
      const todayTodos = todos.filter((t) => t.due_date && t.due_date <= today);
      const todoDone = todayTodos.filter((t) => t.done).length;
      const todoAll = todos.filter((t) => !t.done).length;

      // 晚餐可吃 = 目标 − 今天已吃的一切（三餐+饮品+零食）+ 晚餐自己。
      // `eaten` 来自 dayCalories，本就含饮品零食；这里必须跟饮食页同一个算法，
      // 否则两处「晚餐还能吃」对不上（2026-07-28 一起修）。
      const dn = meals.晚.calories ?? 0;

      const todayHabits = habits.filter((h) => habitOnDay(h, tNum));
      const habitDone = todayHabits.filter((h) => checkins.get(h.id)?.has(today)).length;

      const todayEntries = entries.filter((e) => e.entry_date === today && e.kind !== "note");
      const learnDone = todayEntries.filter(entryDone).length;

      const weekMon = mondayOf(today);
      const bars: (Bar | null)[] = [];
      for (let d = 0; d < 7; d++) {
        const date = addDays(weekMon, d);
        if (date > today) {
          bars.push(null);
          continue;
        }
        const cs = await listCheckStatus(date);
        const dayItems = items.filter((i) => matchesDay(i, d + 1));
        const done = dayItems.filter((i) => cs.get(i.id) === "done").length;
        bars.push({ done, total: dayItems.length, isToday: date === today });
      }

      setStats({
        plan: { done: planDone, total: todayPlan.length },
        todo: { done: todoDone, total: todayTodos.length, all: todoAll },
        cal: { eaten, target: calTarget, dinner: calTarget - (eaten - dn) },
        habit: { done: habitDone, total: todayHabits.length },
        learn: { done: learnDone, total: todayEntries.length },
        bars,
      });
    })().catch(() => {});
  }, []);

  async function togglePeriod() {
    const next = !periodOn;
    setPeriodState(next);
    await setPeriodOn(next);
  }

  /** 存一格体重。date 可以是昨天（「前晚睡前」写的就是昨天的 pm） */
  async function saveWeight(date: string, slot: "am" | "pm", str: string) {
    const v = str.trim() === "" ? null : Number(str);
    if (v != null && !isFinite(v)) return;
    await setWeightEntry(date, slot, v);
    setWeightLog((prev) => ({
      ...prev,
      [date]: {
        am: slot === "am" ? v : prev[date]?.am ?? null,
        pm: slot === "pm" ? v : prev[date]?.pm ?? null,
      },
    }));
  }

  /** 跳到小表格的某张表（走 hash，Tauri 桌面端也通用；别写成 github.io 的完整网址） */
  function openTable(tableId: string) {
    window.location.hash = `/mini-table/${tableId}`;
  }
  const openPlanWeekTable = () => openTable("tbl-plan-week");

  // 空腹体重：只取**最近 7 天**（Rosie 要求，全历史挤在一起看不清曲线）。
  // x 按「第几天」定位而不是按第几个点，所以没记的那天会留空档、曲线不会被拉直。
  const wDays = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const wPts = wDays
    .map((d, i) => ({ d, i, v: weightLog[d]?.am ?? null }))
    .filter((p): p is { d: string; i: number; v: number } => p.v != null);

  const s = stats;
  // 柱状图按条数画：全周最忙那天的条数当满格，各天之间才可比
  const weekDone = s ? s.bars.reduce((n, b) => n + (b?.done ?? 0), 0) : 0;
  const weekTotal = s ? s.bars.reduce((n, b) => n + (b?.total ?? 0), 0) : 0;
  const barMax = Math.max(1, ...(s?.bars ?? []).map((b) => b?.total ?? 0));
  const metrics: { label: string; value: string; sub: string; id: string }[] = s
    ? [
        { label: "时间轴", value: `${s.plan.done}/${s.plan.total}`, sub: "今日已完成", id: "study-plan" },
        {
          label: "待办",
          value: `${s.todo.done}/${s.todo.total}`,
          sub: `今天要做${s.todo.all > s.todo.total ? ` · 未完成共 ${s.todo.all}` : ""}`,
          id: "todo",
        },
        {
          label: "卡路里",
          value: `${s.cal.eaten}`,
          sub: `目标 ${s.cal.target} · 晚餐${s.cal.dinner < 0 ? `超${-s.cal.dinner}` : `可吃 ${s.cal.dinner}`}`,
          id: "supplement",
        },
        { label: "打卡", value: `${s.habit.done}/${s.habit.total}`, sub: "今日习惯", id: "todo" },
        { label: "日日学", value: `${s.learn.done}/${s.learn.total}`, sub: "今天看完", id: "study-log" },
      ]
    : [];

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">总览</h1>
        <span className="text-sm text-muted-foreground">{todayStr()}</span>
        <button
          onClick={togglePeriod}
          title="经期模式：自动隐藏腹部相关训练、暂停所有保健品（全应用生效）"
          className={cn(
            "ml-auto rounded-full border px-3 py-1 text-sm transition-colors",
            periodOn ? "border-pink-300 bg-pink-50 text-pink-700" : "text-muted-foreground hover:bg-accent",
          )}
        >
          🩸 经期{periodOn ? "中 · 已避开腹部 + 停保健品" : "模式"}
        </button>
      </div>

      {/* 今日各模块完成度 */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {s
          ? metrics.map((m) => (
              <button
                key={m.label}
                onClick={() => onOpenModule(m.id)}
                className={cn(CARD, "text-left transition-colors hover:bg-accent/40")}
              >
                <div className="text-sm text-muted-foreground">{m.label}</div>
                <div className="mt-1 text-2xl font-medium">{m.value}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{m.sub}</div>
              </button>
            ))
          : Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={CARD}>
                <div className="text-sm text-muted-foreground">…</div>
                <div className="mt-1 text-2xl font-medium">—</div>
              </div>
            ))}
      </div>

      {/* 本周时间轴完成：柱子按「条数」画（不是按比例），左侧带刻度，一眼看出总量和完成了多少 */}
      <div className={cn("mb-6", CARD)}>
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-sm font-medium">本周时间轴完成</h2>
          {s && (
            <span className="text-xs text-muted-foreground">
              本周已完成 <b className="text-foreground">{weekDone}</b> / {weekTotal} 项
            </span>
          )}
          <button onClick={openPlanWeekTable} className="ml-auto text-xs text-primary hover:underline">
            本周复盘 →
          </button>
        </div>
        {/* 灰底＝当天该做的总条数，蓝色＝已完成；柱高统一按 barMax 换算，所以各天之间可比 */}
        <div className="flex gap-2" style={{ height: 96 }}>
          <div className="flex w-6 shrink-0 flex-col justify-between py-0.5 text-right text-[10px] text-muted-foreground">
            <span>{barMax}</span>
            <span>{Math.round(barMax / 2)}</span>
            <span>0</span>
          </div>
          <div className="flex flex-1 items-end justify-between gap-2">
            {(s?.bars ?? Array.from({ length: 7 }, () => null)).map((b, i) => (
              <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1" style={{ height: "100%" }}>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {b ? `${b.done}/${b.total}` : ""}
                </span>
                <div className="relative flex w-full flex-1 items-end">
                  {b && (
                    <div
                      className="w-full rounded-t bg-muted"
                      style={{ height: `${(b.total / barMax) * 100}%` }}
                      title={`${DAY_LABELS[i]}：该做 ${b.total} 项，完成 ${b.done} 项`}
                    >
                      <div
                        className={cn(
                          "absolute bottom-0 w-full rounded-t",
                          b.isToday ? "bg-primary" : "bg-primary/50",
                        )}
                        style={{ height: `${(b.done / barMax) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
                <span className={cn("text-[11px]", b?.isToday ? "font-medium text-primary" : "text-muted-foreground")}>
                  {DAY_LABELS[i]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 体重趋势（空腹体重，朝 12/27 目标线） */}
      <div className={cn("mb-6", CARD)}>
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="text-sm font-medium">最近七天体重趋势</h2>
          <span className="text-xs text-muted-foreground">目标 12/27 ≤ {WEIGHT_GOAL}kg</span>
          {/* 口径跟饮食页统一（2026-07-29）：前晚睡前 → 今晨空腹，这两个数的差＝一夜的变化。
              只有两格是对的：她睡前不开界面，睡前体重第二天早上当「前晚」一起补。 */}
          <label className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            前晚睡前
            <input type="number" step="0.1" value={wLastPm} onChange={(e) => setWLastPm(e.target.value)}
              onBlur={(e) => saveWeight(yesterday, "pm", e.target.value)}
              className="h-7 w-16 rounded-md border bg-transparent px-2 text-sm" /> kg
          </label>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            今晨空腹
            <input type="number" step="0.1" value={wAm} onChange={(e) => setWAm(e.target.value)}
              onBlur={(e) => saveWeight(today, "am", e.target.value)}
              className="h-7 w-16 rounded-md border bg-transparent px-2 text-sm" /> kg
          </label>
        </div>
        {wPts.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">最近七天还没记空腹体重，记两天就有曲线了。</p>
        ) : (
          (() => {
            const W = 640, H = 130, padX = 26, padY = 20;
            const vals = wPts.map((p) => p.v);
            // 纵轴只按这七天的实测值取范围（不再把 58 目标塞进来压平曲线），
            // 目标线在范围内才画——否则 3 公斤的差距会让 0.3 公斤的日间波动看不见。
            const lo = Math.min(...vals), hi = Math.max(...vals);
            const span = Math.max(1, hi - lo);
            const yMin = lo - span * 0.35;
            const yMax = hi + span * 0.35;
            const x = (dayIdx: number) => padX + (dayIdx * (W - padX * 2)) / 6;
            const y = (v: number) => H - padY - ((v - yMin) / (yMax - yMin)) * (H - padY * 2);
            const line = wPts
              .map((p, k) => `${k === 0 ? "M" : "L"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`)
              .join(" ");
            const goalInRange = WEIGHT_GOAL >= yMin && WEIGHT_GOAL <= yMax;
            const last = wPts[wPts.length - 1];
            const first = wPts[0];
            const delta = wPts.length > 1 ? last.v - first.v : 0;
            return (
              <div>
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 130 }} preserveAspectRatio="none">
                  {goalInRange && (
                    <line x1={padX} y1={y(WEIGHT_GOAL)} x2={W - padX} y2={y(WEIGHT_GOAL)}
                      stroke="#1D9E75" strokeWidth={1} strokeDasharray="4 4" />
                  )}
                  <path d={line} fill="none" stroke="#378ADD" strokeWidth={2}
                    strokeLinecap="round" strokeLinejoin="round" />
                  {wPts.map((p) => (
                    <circle key={p.d} cx={x(p.i)} cy={y(p.v)} r={3} fill="#378ADD" />
                  ))}
                </svg>
                <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
                  {wDays.map((d) => (
                    <span key={d} className={cn("flex-1 text-center", d === today && "font-medium text-primary")}>
                      {d.slice(5).replace("-", "/")}
                    </span>
                  ))}
                </div>
                <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
                  <span>
                    最新 <b className="text-foreground">{last.v}kg</b>
                    {last.v > WEIGHT_GOAL ? `（离目标 ${(last.v - WEIGHT_GOAL).toFixed(1)}）` : "（已达标 🎉）"}
                  </span>
                  {wPts.length > 1 && (
                    <span>
                      七天{delta <= 0 ? "掉了 " : "涨了 "}
                      <b className={delta <= 0 ? "text-emerald-600" : "text-amber-600"}>
                        {Math.abs(delta).toFixed(1)}kg
                      </b>
                    </span>
                  )}
                  {!goalInRange && <span>目标线 {WEIGHT_GOAL}kg 不在这七天的范围内</span>}
                </div>
              </div>
            );
          })()
        )}
      </div>

      {/* 原来这儿有一排「模块入口摘要卡」（时间轴/待办/饮食/日日学/小表格），
          2026-07-28 Rosie 要求删除：左边侧栏已经能进各模块，顶排完成度卡也能点进去，
          这排纯属重复，还把总览拉得很长。各模块的 `Card` 组件因此在总览里不再被用到
          （registry 里仍保留，将来做仪表盘自定义布局时可以复用）。 */}
    </div>
  );
}
