import { useEffect, useState } from "react";
import { ListTodo, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  const today = todayStr();

  useEffect(() => {
    listTodos().then(setTodos);
  }, []);

  const patch = (id: string, p: Partial<Todo>) =>
    setTodos((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));

  const isToday = (t: Todo) => !!t.due_date && t.due_date <= today;
  const pending = todos.filter((t) => !t.done);
  const finished = todos.filter((t) => t.done);

  const match = (t: Todo) =>
    (!filterQ || t.quadrant === filterQ) && (!filterToday || isToday(t));
  const pendingShown = pending.filter(match);
  const finishedShown = finished.filter(match);

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
    ...QUADRANTS.map((q) => ({
      key: q.key as Quadrant | "today",
      name: q.name,
      count: pending.filter((t) => t.quadrant === q.key).length,
      style: Q_STYLE[q.key],
      active: filterQ === q.key,
      onClick: () => setFilterQ(filterQ === q.key ? null : q.key),
    })),
    {
      key: "today" as const,
      name: "今天",
      count: pending.filter(isToday).length,
      style: null,
      active: filterToday,
      onClick: () => setFilterToday((v) => !v),
    },
  ];

  return (
    <div className="p-6">
      <ReviewBanner />

      <div className="grid items-start gap-6 xl:grid-cols-[1.6fr_260px]">
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
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
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
          <div className="space-y-1.5">
            {pendingShown.map((t) => {
              const today_ = isToday(t);
              return (
                <div key={t.id} className="group flex items-center gap-2.5 rounded-md border px-3 py-2">
                  <Checkbox checked={!!t.done} onCheckedChange={() => handleToggle(t)} className="size-5" />
                  <EditableText
                    value={t.title}
                    onSave={(v) => handleRename(t.id, v)}
                    className="min-w-0 flex-1 truncate text-sm"
                    inputClassName="flex-1 text-sm"
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
              );
            })}
          </div>

          {pendingShown.length === 0 && (
            <p className="py-6 text-sm text-muted-foreground">
              {filterQ || filterToday ? "这个筛选下没有待办。" : "待办清空啦，想到什么先记进来。"}
            </p>
          )}

          {finishedShown.length > 0 && (
            <>
              <div className="mb-1.5 mt-4 flex items-center justify-between">
                <h3 className="text-xs font-medium text-muted-foreground">
                  已完成 {finishedShown.length} 项
                </h3>
                <Button variant="ghost" size="sm" onClick={handleClearDone}>
                  清除已完成
                </Button>
              </div>
              <div className="space-y-1.5">
                {finishedShown.map((t) => (
                  <div key={t.id} className="group flex items-center gap-2.5 rounded-md border px-3 py-2">
                    <Checkbox checked onCheckedChange={() => handleToggle(t)} className="size-5" />
                    <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground line-through">
                      {t.title}
                    </span>
                    <button
                      className="invisible shrink-0 text-muted-foreground hover:text-destructive group-hover:visible"
                      title="删除"
                      onClick={() => handleDelete(t.id)}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* 打卡（窄） */}
        <section className="rounded-xl border bg-card p-4">
          <HabitPanel compact />
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
