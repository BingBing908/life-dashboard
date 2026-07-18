import { useEffect, useState } from "react";
import { ListTodo, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  toggleTodo,
  type Todo,
} from "./data";

function Card() {
  const [summary, setSummary] = useState<{
    pending: Todo[];
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
      setSummary({
        pending: todos.filter((t) => !t.done),
        habitsTotal: habits.length,
        habitsDone: habits.filter((h) => checkins.get(h.id)?.has(today)).length,
      });
    })().catch(() =>
      setSummary({ pending: [], habitsTotal: 0, habitsDone: 0 }),
    );
  }, []);

  if (summary === null)
    return <p className="text-sm text-muted-foreground">加载中…</p>;
  const { pending, habitsTotal, habitsDone } = summary;
  if (pending.length === 0 && habitsTotal === 0)
    return (
      <p className="text-sm text-muted-foreground">
        记下想到的事，别让脑子当便签。
      </p>
    );
  return (
    <div className="space-y-1 text-sm text-muted-foreground">
      <p>
        待办 <span className="font-medium text-foreground">{pending.length}</span> 项
        {habitsTotal > 0 && (
          <>
            {" · 打卡 "}
            <span className="font-medium text-foreground">{habitsDone}</span>/
            {habitsTotal}
          </>
        )}
      </p>
      {pending.slice(0, 3).map((t) => (
        <p key={t.id} className="truncate">· {t.title}</p>
      ))}
      {pending.length === 0 && <p>今日待办全部完成 ✨</p>}
    </div>
  );
}

function Page() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    listTodos().then(setTodos);
  }, []);

  const pending = todos.filter((t) => !t.done);
  const finished = todos.filter((t) => t.done);

  async function handleCreate() {
    const title = newTitle.trim();
    if (!title) return;
    const maxOrder = Math.max(0, ...pending.map((t) => t.sort_order));
    const t = await createTodo(title, maxOrder + 1);
    setTodos((ts) => [...ts, t]);
    setNewTitle("");
  }

  async function handleToggle(todo: Todo) {
    const done = !todo.done;
    setTodos((ts) =>
      ts.map((t) =>
        t.id === todo.id
          ? { ...t, done: done ? 1 : 0, done_at: done ? new Date().toISOString() : null }
          : t,
      ),
    );
    await toggleTodo(todo.id, done);
  }

  async function handleDelete(id: string) {
    setTodos((ts) => ts.filter((t) => t.id !== id));
    await deleteTodo(id);
  }

  async function handleClearDone() {
    setTodos((ts) => ts.filter((t) => !t.done));
    await clearDone();
  }

  function TodoRow({ todo }: { todo: Todo }) {
    return (
      <div className="group flex items-center gap-3 rounded-md border px-3 py-2">
        <Checkbox
          checked={!!todo.done}
          onCheckedChange={() => handleToggle(todo)}
          className="size-5"
        />
        <span
          className={cn(
            "flex-1 text-sm",
            todo.done && "text-muted-foreground line-through",
          )}
        >
          {todo.title}
        </span>
        <button
          className="invisible text-muted-foreground hover:text-destructive group-hover:visible"
          title="删除"
          onClick={() => handleDelete(todo.id)}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-8 p-6 lg:grid-cols-2">
      {/* 左：今天临时的新任务 */}
      <section>
        <div className="mb-4 flex items-baseline gap-3">
          <h2 className="text-xl font-semibold">To Do List</h2>
          <span className="text-sm text-muted-foreground">今天临时要做的</span>
          {pending.length > 0 && (
            <span className="ml-auto text-sm text-muted-foreground">
              还剩 {pending.length} 项
            </span>
          )}
        </div>

        <div className="mb-6 flex gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="要做什么？回车添加"
          />
          <Button onClick={handleCreate}>
            <Plus className="size-4" /> 添加
          </Button>
        </div>

        <div className="space-y-1.5">
          {pending.map((t) => (
            <TodoRow key={t.id} todo={t} />
          ))}
        </div>

        {finished.length > 0 && (
          <>
            <div className="mb-2 mt-6 flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">
                已完成 {finished.length} 项
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearDone}>
                清除已完成
              </Button>
            </div>
            <div className="space-y-1.5">
              {finished.map((t) => (
                <TodoRow key={t.id} todo={t} />
              ))}
            </div>
          </>
        )}

        {todos.length === 0 && (
          <p className="mt-8 text-muted-foreground">
            清单是空的。想到什么要做的，随手记在这里。
          </p>
        )}
      </section>

      {/* 右：每天例行的打卡 */}
      <section className="border-t pt-8 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
        <HabitPanel />
      </section>
    </div>
  );
}

const todoModule: AppModule = {
  manifest: {
    id: "todo",
    name: "To Do List",
    icon: ListTodo,
    description: "今日临时待办 + 每日例行打卡",
    defaultSize: { w: 2, h: 1 },
  },
  Card,
  Page,
};

export default todoModule;
