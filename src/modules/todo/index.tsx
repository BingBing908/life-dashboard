import { useEffect, useState } from "react";
import { ListTodo, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AppModule } from "../types";
import {
  clearDone,
  createTodo,
  deleteTodo,
  listTodos,
  toggleTodo,
  type Todo,
} from "./data";

function Card() {
  const [todos, setTodos] = useState<Todo[] | null>(null);

  useEffect(() => {
    listTodos().then(setTodos).catch(() => setTodos([]));
  }, []);

  if (todos === null)
    return <p className="text-sm text-muted-foreground">加载中…</p>;
  const pending = todos.filter((t) => !t.done);
  if (pending.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        {todos.length === 0 ? "记下想到的事，别让脑子当便签。" : "全部完成，干得漂亮 ✨"}
      </p>
    );
  return (
    <div className="space-y-1 text-sm text-muted-foreground">
      <p>
        待办 <span className="font-medium text-foreground">{pending.length}</span> 项
      </p>
      {pending.slice(0, 3).map((t) => (
        <p key={t.id} className="truncate">· {t.title}</p>
      ))}
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
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-4 flex items-baseline gap-3">
        <h1 className="text-2xl font-semibold">To Do List</h1>
        {pending.length > 0 && (
          <span className="text-muted-foreground">还剩 {pending.length} 项</span>
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
            <h2 className="text-sm font-medium text-muted-foreground">
              已完成 {finished.length} 项
            </h2>
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
    </div>
  );
}

const todoModule: AppModule = {
  manifest: {
    id: "todo",
    name: "To Do List",
    icon: ListTodo,
    description: "零散待办，想到就记",
    defaultSize: { w: 1, h: 1 },
  },
  Card,
  Page,
};

export default todoModule;
