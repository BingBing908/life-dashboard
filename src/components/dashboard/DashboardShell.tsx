import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { addDays, mondayOf, todayStr } from "@/lib/dates";
import { modules } from "@/modules/registry";
import {
  dayNumOf,
  getPeriodOn,
  listCheckStatus,
  listItems,
  matchesDay,
  setPeriodOn,
} from "@/modules/study-plan/data";
import { listTodos } from "@/modules/todo/data";
import { dayCalories, getCalTarget, getMeals } from "@/modules/supplement/data";
import { getCheckins, habitOnDay, listHabits } from "@/modules/habit-checkin/data";
import { listAllEntries } from "@/modules/study-log/data";
import { entryDone } from "@/modules/study-log";

interface Props {
  onOpenModule: (id: string) => void;
}

interface Bar { done: number; total: number; isToday: boolean }
interface Stats {
  plan: { done: number; total: number };
  todo: { done: number; total: number };
  cal: { eaten: number; target: number; dinner: number };
  habit: { done: number; total: number };
  learn: { done: number; total: number };
  bars: (Bar | null)[];
}

const DAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

/** 今日总览：今日各模块完成度 + 本周学练完成 + 模块入口 */
export function DashboardShell({ onOpenModule }: Props) {
  const [periodOn, setPeriodState] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    getPeriodOn().then(setPeriodState).catch(() => {});
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

      const todayTodos = todos.filter((t) => t.due_date && t.due_date <= today);
      const todoDone = todayTodos.filter((t) => t.done).length;

      const bf = meals.早.calories ?? 0;
      const lu = meals.午.calories ?? 0;

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
        todo: { done: todoDone, total: todayTodos.length },
        cal: { eaten, target: calTarget, dinner: calTarget - bf - lu },
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

  const s = stats;
  const metrics: { label: string; value: string; sub: string; id: string }[] = s
    ? [
        { label: "时间轴", value: `${s.plan.done}/${s.plan.total}`, sub: "今日已完成", id: "study-plan" },
        { label: "待办", value: `${s.todo.done}/${s.todo.total}`, sub: "今天要做", id: "todo" },
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
        <h1 className="text-2xl font-semibold">今日总览</h1>
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
                className="rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/40"
              >
                <div className="text-sm text-muted-foreground">{m.label}</div>
                <div className="mt-1 text-2xl font-medium">{m.value}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{m.sub}</div>
              </button>
            ))
          : Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-4">
                <div className="text-sm text-muted-foreground">…</div>
                <div className="mt-1 text-2xl font-medium">—</div>
              </div>
            ))}
      </div>

      {/* 本周学练完成 */}
      <div className="mb-6 rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-baseline gap-2">
          <h2 className="text-sm font-medium">本周时间轴完成</h2>
          <button onClick={() => onOpenModule("mini-table")} className="ml-auto text-xs text-primary hover:underline">
            本周复盘（小表格）→
          </button>
        </div>
        <div className="flex items-end justify-between gap-2" style={{ height: 72 }}>
          {(s?.bars ?? Array.from({ length: 7 }, () => null)).map((b, i) => {
            const ratio = b && b.total > 0 ? b.done / b.total : 0;
            return (
              <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1" style={{ height: "100%" }}>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className={cn("w-full rounded-t", b?.isToday ? "bg-primary" : "bg-primary/40")}
                    style={{ height: `${Math.max(b ? 6 : 0, ratio * 100)}%` }}
                    title={b ? `${b.done}/${b.total}` : "未到"}
                  />
                </div>
                <span className={cn("text-[11px]", b?.isToday ? "font-medium text-primary" : "text-muted-foreground")}>
                  {DAY_LABELS[i]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 模块入口（摘要卡） */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {modules.map(({ manifest, Card: ModuleCard }) => {
          const Icon = manifest.icon;
          const size = manifest.defaultSize ?? { w: 1, h: 1 };
          return (
            <Card
              key={manifest.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpenModule(manifest.id)}
              onKeyDown={(e) => e.key === "Enter" && onOpenModule(manifest.id)}
              className="cursor-pointer transition-colors hover:bg-accent/50"
              style={{ gridColumn: `span ${size.w}`, gridRow: `span ${size.h}` }}
            >
              <CardHeader className="flex flex-row items-center gap-2">
                <Icon className="size-5 text-muted-foreground" />
                <CardTitle className="text-base">{manifest.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <ModuleCard />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
