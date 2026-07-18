import { useEffect, useState } from "react";
import { ListTodo, Plus, Sun, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
    todayPending: number;
    backlog: number;
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
        todayPending: pending.filter((t) => t.due_date && t.due_date <= today).length,
        backlog: pending.filter((t) => !t.due_date || t.due_date > today).length,
        habitsTotal: habits.length,
        habitsDone: habits.filter((h) => checkins.get(h.id)?.has(today)).length,
      });
    })().catch(() =>
      setSummary({ todayPending: 0, backlog: 0, habitsTotal: 0, habitsDone: 0 }),
    );
  }, []);

  if (summary === null)
    return <p className="text-sm text-muted-foreground">加载中…</p>;
  const { todayPending, backlog, habitsTotal, habitsDone } = summary;
  return (
    <p className="text-sm text-muted-foreground">
      今天 <span className="font-medium text-foreground">{todayPending}</span> 项
      {" · 待办池 "}
      <span className="font-medium text-foreground">{backlog}</span>
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
  const today = todayStr();

  useEffect(() => {
    listTodos().then(setTodos);
  }, []);

  const patch = (id: string, p: Partial<Todo>) =>
    setTodos((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));

  // 今天：到期日 <= 今天（含逾期）；待办池：无到期日或在未来
  const todayItems = todos.filter((t) => t.due_date && t.due_date <= today);
  const todayPending = todayItems.filter((t) => !t.done);
  const todayFinished = todayItems.filter((t) => t.done);
  const backlog = todos.filter((t) => !t.done && (!t.due_date || t.due_date > today));
  const backlogShown = filterQ ? backlog.filter((t) => t.quadrant === filterQ) : backlog;

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

  async function moveToToday(id: string) {
    patch(id, { due_date: today });
    await setTodoDueDate(id, today);
  }

  async function moveToBacklog(id: string) {
    patch(id, { due_date: null });
    await setTodoDueDate(id, null);
  }

  async function handleClearDone() {
    setTodos((ts) => ts.filter((t) => !t.done));
    await clearDone();
  }

  return (
    <div className="p-6">
      <ReviewBanner />

      <div className="mb-4 flex items-center gap-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="要做什么？回车添加"
          className="max-w-xs"
        />
        <Select value={newQuadrant} onValueChange={(v) => setNewQuadrant(v as Quadrant)}>
          <SelectTrigger className="w-36">
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
          今天做
        </label>
        <Button onClick={handleCreate}>
          <Plus className="size-4" /> 添加
        </Button>
        <WeeklyReviewDialog
          trigger={
            <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground">
              本周复盘
            </Button>
          }
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1.1fr_1.4fr_240px]">
        {/* 左：今天 */}
        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-baseline gap-2">
            <h2 className="text-lg font-semibold">To Do List</h2>
            <span className="text-xs text-muted-foreground">今天要做掉的</span>
            {todayPending.length > 0 && (
              <span className="ml-auto text-xs text-muted-foreground">
                还剩 {todayPending.length} 项
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            {todayPending.map((t) => (
              <div key={t.id} className="group flex items-center gap-2.5 rounded-md border px-3 py-2">
                <Checkbox checked={!!t.done} onCheckedChange={() => handleToggle(t)} className="size-5" />
                <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                {t.due_date && t.due_date < today && (
                  <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] text-red-600">
                    逾期
                  </span>
                )}
                <QuadrantTag q={t.quadrant} />
                <button
                  className="invisible shrink-0 text-muted-foreground hover:text-foreground group-hover:visible"
                  title="移回待办"
                  onClick={() => moveToBacklog(t.id)}
                >
                  <Undo2 className="size-4" />
                </button>
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

          {todayPending.length === 0 && (
            <p className="py-6 text-sm text-muted-foreground">
              {todayFinished.length > 0
                ? "今天的事全部做完了，干得漂亮 ✨"
                : "还没安排今天的事——去中间待办池点 ☀️ 送进来。"}
            </p>
          )}

          {todayFinished.length > 0 && (
            <>
              <div className="mb-1.5 mt-4 flex items-center justify-between">
                <h3 className="text-xs font-medium text-muted-foreground">
                  已完成 {todayFinished.length} 项
                </h3>
                <Button variant="ghost" size="sm" onClick={handleClearDone}>
                  清除已完成
                </Button>
              </div>
              <div className="space-y-1.5">
                {todayFinished.map((t) => (
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

        {/* 中：待办池 + 四象限筛选 */}
        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-baseline gap-2">
            <h2 className="text-lg font-semibold">待办</h2>
            <span className="text-xs text-muted-foreground">囤在这里，点 ☀️ 送进今天</span>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2">
            {QUADRANTS.map((q) => {
              const s = Q_STYLE[q.key];
              const n = backlog.filter((t) => t.quadrant === q.key).length;
              const active = filterQ === q.key;
              return (
                <button
                  key={q.key}
                  onClick={() => setFilterQ(active ? null : q.key)}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2 text-left transition-all",
                    s.bg,
                    active ? "ring-2 ring-ring" : "hover:opacity-80",
                  )}
                >
                  <span className={cn("text-xs font-medium", s.text)}>{q.name}</span>
                  <span className={cn("text-lg font-semibold", s.text)}>{n}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            {backlogShown.map((t) => (
              <div key={t.id} className="group flex items-center gap-2.5 rounded-md border px-3 py-2">
                <span className={cn("size-2 shrink-0 rounded-full", Q_STYLE[t.quadrant].dot)} />
                <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                <button
                  className="shrink-0 text-muted-foreground hover:text-amber-500"
                  title="加入今天"
                  onClick={() => moveToToday(t.id)}
                >
                  <Sun className="size-4" />
                </button>
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

          {backlogShown.length === 0 && (
            <p className="py-6 text-sm text-muted-foreground">
              {filterQ ? "这个象限空着。" : "待办池是空的，想到什么先记进来。"}
            </p>
          )}
        </section>

        {/* 右：打卡（窄） */}
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
    name: "To Do List",
    icon: ListTodo,
    description: "今天 + 四象限待办 + 例行打卡",
    defaultSize: { w: 2, h: 1 },
  },
  Card,
  Page,
};

export default todoModule;
