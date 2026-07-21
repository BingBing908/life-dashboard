import { useEffect, useState } from "react";
import { ListTodo, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapse } from "@/components/Collapse";
import { DoneToggle } from "@/components/DoneToggle";
import { Input } from "@/components/ui/input";
import { EditableText } from "@/components/EditableText";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { todayStr } from "@/lib/dates";
import type { AppModule } from "../types";
import { HabitPanel } from "../habit-checkin";
import { getCheckins, listHabits } from "../habit-checkin/data";
import {
  dayNumOf,
  listCheckStatus as listPlanStatus,
  listLatestNotes,
  listNotes,
  matchesDay,
  seedIfEmpty as seedPlan,
  setCheckStatus as setPlanCheckStatus,
  setNote,
  type CheckStatus,
  type PlanItem,
} from "../study-plan/data";
import {
  clearDone,
  createTodo,
  deleteTodo,
  listTodos,
  QUADRANTS,
  setTodoDueDate,
  toggleTodo,
  updateTodoTitle,
  type Quadrant,
  type Todo,
} from "./data";
import { ReviewBanner, WeeklyReviewDialog } from "./WeeklyReview";

/** 四象限配色（bg 底 / text 字 / dot 圆点） */
const Q_STYLE: Record<Quadrant, { bg: string; text: string; dot: string }> = {
  iu: { bg: "bg-red-50",    text: "text-red-800",    dot: "bg-red-500" },
  in: { bg: "bg-amber-50",  text: "text-amber-800",  dot: "bg-amber-500" },
  nu: { bg: "bg-blue-50",   text: "text-blue-800",   dot: "bg-blue-500" },
  nn: { bg: "bg-zinc-100",  text: "text-zinc-600",   dot: "bg-zinc-400" },
};

function QuadrantTag({ q }: { q: Quadrant }) {
  const s = Q_STYLE[q];
  const name = QUADRANTS.find((x) => x.key === q)?.name ?? q;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px]",
        s.bg,
        s.text,
      )}
    >
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {name}
    </span>
  );
}

/** 已完成的待办行：勾态 + 标题划线 + 「做了：…」笔记（今天完成的留主列表底部、更早的进历史已完成，两处同一展示） */
function FinishedRow({ todo, note, dateLabel, onClear, onDelete }: { todo: Todo; note: string; dateLabel?: string; onClear: () => void; onDelete: () => void }) {
  return (
    <div className="group rounded-lg border px-4 py-3 hover:bg-accent/40">
      <div className="flex items-center gap-3">
        <DoneToggle state="done" onDone={() => {}} onSkip={() => {}} onClear={onClear} size="sm" />
        <span className="min-w-0 flex-1 truncate text-[15px] text-muted-foreground line-through">{todo.title}</span>
        {dateLabel && <span className="shrink-0 text-[11px] text-muted-foreground/70">{dateLabel}</span>}
        <button
          className="invisible shrink-0 text-muted-foreground hover:text-destructive group-hover:visible"
          title="删除"
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      {note.trim() && (
        <p className="mt-1.5 pl-1 text-xs text-muted-foreground">
          <span className="text-muted-foreground/70">做了：</span>
          {note}
        </p>
      )}
    </div>
  );
}

function Card() {
  const [summary, setSummary] = useState<{
    today: number;
    total: number;
    habitsTotal: number;
    habitsDone: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const [todos, habits, checkins] = await Promise.all([
        listTodos(),
        listHabits(),
        getCheckins(1),
      ]);
      const today = todayStr();
      const pending = todos.filter((t) => !t.done);
      setSummary({
        today: pending.filter((t) => t.due_date && t.due_date <= today).length,
        total: pending.length,
        habitsTotal: habits.length,
        habitsDone: habits.filter((h) => checkins.get(h.id)?.has(today)).length,
      });
    })().catch(() =>
      setSummary({ today: 0, total: 0, habitsTotal: 0, habitsDone: 0 }),
    );
  }, []);

  if (summary === null)
    return <p className="text-sm text-muted-foreground">加载中…</p>;
  const { today, total, habitsTotal, habitsDone } = summary;
  return (
    <p className="text-sm text-muted-foreground">
      待办 <span className="font-medium text-foreground">{total}</span> 项（今天{" "}
      <span className="font-medium text-foreground">{today}</span>）
      {habitsTotal > 0 && (
        <>
          {" · 打卡 "}
          <span className="font-medium text-foreground">{habitsDone}</span>/{habitsTotal}
        </>
      )}
    </p>
  );
}

function Page() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newQuadrant, setNewQuadrant] = useState<Quadrant>("in");
  const [newToToday, setNewToToday] = useState(false);
  const [filterQ, setFilterQ] = useState<Quadrant | null>(null);
  const [filterToday, setFilterToday] = useState(false);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [planStatus, setPlanStatus] = useState<Map<string, CheckStatus>>(new Map());
  const [notes, setNotes] = useState<Record<string, string>>({}); // 今天的「我做了什么」，存 plan_notes（可编辑）
  const [histNotes, setHistNotes] = useState<Record<string, string>>({}); // 各条目最近一天的笔记（历史已完成回看用，只读）
  const today = todayStr();

  useEffect(() => {
    listTodos().then(setTodos);
    seedPlan().then(setPlanItems);
    listPlanStatus(today).then(setPlanStatus);
    listNotes(today).then((m) => setNotes(Object.fromEntries(m)));
    listLatestNotes().then(setHistNotes);
  }, [today]);

  function saveTodoNote(id: string, v: string) {
    setNotes((s) => ({ ...s, [id]: v }));
    setNote(id, today, v);
  }

  // 今天的学练计划（活读取，镜像进「今天」）；待做排上面，已决定沉到下方
  const planToday = planItems
    .filter((i) => matchesDay(i, dayNumOf(today)))
    .sort((a, b) => Number(planStatus.has(a.id)) - Number(planStatus.has(b.id)));

  async function setPlan(id: string, next: CheckStatus | null) {
    setPlanStatus((prev) => {
      const m = new Map(prev);
      if (next === null) m.delete(id);
      else m.set(id, next);
      return m;
    });
    await setPlanCheckStatus(id, today, next);
  }

  const patch = (id: string, p: Partial<Todo>) =>
    setTodos((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));

  const isToday = (t: Todo) => !!t.due_date && t.due_date <= today;
  const doneDate = (t: Todo) => (t.done_at ? t.done_at.slice(0, 10) : "");
  const pending = todos.filter((t) => !t.done);
  const finished = todos.filter((t) => t.done);
  const finishedToday = finished.filter((t) => doneDate(t) === today); // 今天完成的：留在待办列表最下面
  const finishedHistory = finished.filter((t) => doneDate(t) !== today); // 今天以前完成的：收进历史已完成

  const match = (t: Todo) =>
    (!filterQ || t.quadrant === filterQ) && (!filterToday || isToday(t));
  const pendingShown = pending.filter(match);
  const finishedTodayShown = finishedToday.filter(match);
  const finishedHistoryShown = finishedHistory.filter(match);

  async function handleCreate() {
    const title = newTitle.trim();
    if (!title) return;
    const maxOrder = Math.max(0, ...todos.map((t) => t.sort_order));
    const t = await createTodo(title, newQuadrant, newToToday ? today : null, maxOrder + 1);
    setTodos((ts) => [...ts, t]);
    setNewTitle("");
  }

  async function handleToggle(todo: Todo) {
    const done = !todo.done;
    patch(todo.id, { done: done ? 1 : 0, done_at: done ? new Date().toISOString() : null });
    await toggleTodo(todo.id, done);
  }

  async function handleDelete(id: string) {
    setTodos((ts) => ts.filter((t) => t.id !== id));
    await deleteTodo(id);
  }

  async function toggleToday(t: Todo) {
    const next = isToday(t) ? null : today;
    patch(t.id, { due_date: next });
    await setTodoDueDate(t.id, next);
  }

  async function handleRename(id: string, title: string) {
    patch(id, { title });
    await updateTodoTitle(id, title);
  }

  async function handleClearDone() {
    setTodos((ts) => ts.filter((t) => !t.done));
    await clearDone();
  }

  const tiles = [
    {
      key: "all" as const,
      name: "全部",
      count: pending.length,
      style: null,
      active: !filterQ && !filterToday,
      onClick: () => {
        setFilterQ(null);
        setFilterToday(false);
      },
    },
    ...QUADRANTS.map((q) => ({
      key: q.key as Quadrant | "today" | "all",
      name: q.name,
      count: pending.filter((t) => t.quadrant === q.key).length,
      style: Q_STYLE[q.key],
      active: filterQ === q.key,
      onClick: () => {
        const next = filterQ === q.key ? null : q.key;
        setFilterQ(next);
        if (next) setNewQuadrant(next); // 联动：选了哪个象限框，添加默认就加到该象限
      },
    })),
    {
      key: "today" as const,
      name: "今天",
      count: pending.filter(isToday).length,
      style: null,
      active: filterToday,
      onClick: () => {
        const nv = !filterToday;
        setFilterToday(nv);
        setNewToToday(nv); // 联动：选了「今天」框，添加默认勾今天
      },
    },
  ];

  return (
    <div className="p-6">
      <ReviewBanner />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* 待办：五个筛选框 + 统一列表 */}
        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-baseline gap-2">
            <h2 className="text-lg font-semibold">待办</h2>
            <span className="text-xs text-muted-foreground">点小框筛选，点「今天」标记当天要做</span>
            <WeeklyReviewDialog
              trigger={
                <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground">
                  本周复盘
                </Button>
              }
            />
          </div>

          {/* 五个筛选框 */}
          <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {tiles.map((tile) => (
              <button
                key={tile.key}
                onClick={tile.onClick}
                className={cn(
                  "flex flex-col gap-1 rounded-lg px-3 py-2 text-left transition-all",
                  tile.style ? tile.style.bg : "border bg-card",
                  tile.active ? "ring-2 ring-ring" : "hover:opacity-80",
                )}
              >
                <span
                  className={cn(
                    "text-xs font-medium",
                    tile.style ? tile.style.text : "text-muted-foreground",
                  )}
                >
                  {tile.name}
                </span>
                <span
                  className={cn(
                    "text-xl font-semibold",
                    tile.style ? tile.style.text : "text-foreground",
                  )}
                >
                  {tile.count}
                </span>
              </button>
            ))}
          </div>

          {/* 添加一条 */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="要做什么？回车添加"
              className="min-w-40 flex-1"
            />
            <Select value={newQuadrant} onValueChange={(v) => setNewQuadrant(v as Quadrant)}>
              <SelectTrigger className="w-32">
                <SelectValue>
                  {(v) => QUADRANTS.find((q) => q.key === v)?.name ?? "选择象限"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {QUADRANTS.map((q) => (
                  <SelectItem key={q.key} value={q.key}>
                    <span className={cn("mr-1 inline-block size-2 rounded-full", Q_STYLE[q.key].dot)} />
                    {q.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground">
              <Checkbox checked={newToToday} onCheckedChange={(v) => setNewToToday(!!v)} />
              今天
            </label>
            <Button onClick={handleCreate}>
              <Plus className="size-4" /> 添加
            </Button>
          </div>

          {/* 列表 */}
          <div className="space-y-2">
            {pendingShown.map((t) => {
              const today_ = isToday(t);
              return (
                <div key={t.id} className="group rounded-lg border px-4 py-3.5 hover:bg-accent/40">
                  <div className="flex items-center gap-3">
                    <DoneToggle
                      state={t.done ? "done" : "pending"}
                      onDone={() => handleToggle(t)}
                      onSkip={() => {}}
                      onClear={() => handleToggle(t)}
                      size="sm"
                    />
                    <EditableText
                      value={t.title}
                      onSave={(v) => handleRename(t.id, v)}
                      className="min-w-0 flex-1 truncate text-[15px] font-medium"
                      inputClassName="flex-1 text-[15px]"
                    />
                    <button
                      onClick={() => toggleToday(t)}
                      title={today_ ? "移出今天" : "标记今天做"}
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] transition-colors",
                        today_
                          ? "bg-blue-50 text-blue-700"
                          : "border border-dashed text-muted-foreground opacity-60 hover:opacity-100",
                      )}
                    >
                      今天
                    </button>
                    <QuadrantTag q={t.quadrant} />
                    <button
                      className="invisible shrink-0 text-muted-foreground hover:text-destructive group-hover:visible"
                      title="删除"
                      onClick={() => handleDelete(t.id)}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <input
                    value={notes[t.id] ?? ""}
                    onChange={(e) => saveTodoNote(t.id, e.target.value)}
                    placeholder="我具体做了什么？（选填）"
                    className="mt-2 h-8 w-full rounded-md border bg-background px-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/40"
                  />
                </div>
              );
            })}
            {/* 今天完成的：留在列表最下面（超过今天的才进历史已完成） */}
            {finishedTodayShown.map((t) => (
              <FinishedRow
                key={t.id}
                todo={t}
                note={notes[t.id] ?? ""}
                onClear={() => handleToggle(t)}
                onDelete={() => handleDelete(t.id)}
              />
            ))}
          </div>

          {pendingShown.length === 0 && finishedTodayShown.length === 0 && (
            <p className="py-6 text-sm text-muted-foreground">
              {filterQ || filterToday ? "这个筛选下没有待办。" : "待办清空啦，想到什么先记进来。"}
            </p>
          )}

          {/* 今天的学练计划（镜像，来自学练计划，可勾选）——默认收起免得挤掉待办 */}
          {planToday.length > 0 && (
            <div className="mt-5">
              <Collapse title="今天的学练计划" count={planToday.length} hint="来自学练计划 · 自动同步">
                <div className="space-y-1.5">
                  {planToday.map((i) => {
                    const st = planStatus.get(i.id) ?? "pending";
                    const done = st === "done";
                    const decided = st !== "pending";
                    return (
                      <div key={i.id} className="flex items-center gap-2.5 rounded-md border border-dashed px-3 py-2">
                        <DoneToggle
                          state={st}
                          onDone={() => setPlan(i.id, "done")}
                          onSkip={() => setPlan(i.id, "skip")}
                          onClear={() => setPlan(i.id, null)}
                          size="sm"
                        />
                        <span className={cn("min-w-0 flex-1 truncate text-sm", decided && "text-muted-foreground", done && "line-through")}>
                          {i.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Collapse>
            </div>
          )}

          {/* 历史已完成：只收「今天以前」完成的，默认收起，标完成日期 + 保留「做了什么」 */}
          {finishedHistoryShown.length > 0 && (
            <div className="mt-4">
              <Collapse
                title="历史已完成"
                count={finishedHistoryShown.length}
                right={
                  <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleClearDone}>
                    清除已完成
                  </Button>
                }
              >
                <div className="space-y-1.5">
                  {finishedHistoryShown.map((t) => (
                    <FinishedRow
                      key={t.id}
                      todo={t}
                      note={notes[t.id] ?? histNotes[t.id] ?? ""}
                      dateLabel={t.done_at ? t.done_at.slice(0, 10) : undefined}
                      onClear={() => handleToggle(t)}
                      onDelete={() => handleDelete(t.id)}
                    />
                  ))}
                </div>
              </Collapse>
            </div>
          )}
        </section>

        {/* 打卡（窄） */}
        <section className="rounded-xl border bg-card p-4">
          <HabitPanel compact weekly />
        </section>
      </div>
    </div>
  );
}

const todoModule: AppModule = {
  manifest: {
    id: "todo",
    name: "待办",
    icon: ListTodo,
    description: "四象限待办 + 例行打卡",
    defaultSize: { w: 2, h: 1 },
  },
  Card,
  Page,
};

export default todoModule;
