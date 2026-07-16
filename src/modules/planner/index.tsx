import { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { addDays, formatDateCn, todayStr } from "@/lib/dates";
import type { AppModule } from "../types";
import {
  addTask,
  deleteTask,
  listTasksByDate,
  setTaskDone,
  type PlanTask,
} from "./data";

function Card() {
  const [tasks, setTasks] = useState<PlanTask[] | null>(null);

  useEffect(() => {
    listTasksByDate(todayStr()).then(setTasks).catch(() => setTasks([]));
  }, []);

  if (tasks === null)
    return <p className="text-sm text-muted-foreground">加载中…</p>;
  if (tasks.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        今日暂无计划，点击进入添加任务。
      </p>
    );
  const done = tasks.filter((t) => t.done).length;
  return (
    <div className="space-y-1 text-sm">
      <p className="text-muted-foreground">
        今日 {done}/{tasks.length} 已完成
      </p>
      {tasks.slice(0, 3).map((t) => (
        <p
          key={t.id}
          className={cn("truncate", t.done && "text-muted-foreground line-through")}
        >
          {t.start_time && (
            <span className="mr-1 text-muted-foreground">{t.start_time}</span>
          )}
          {t.title}
        </p>
      ))}
    </div>
  );
}

function Page() {
  const [date, setDate] = useState(todayStr());
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  useEffect(() => {
    listTasksByDate(date).then(setTasks);
  }, [date]);

  async function handleAdd() {
    const t = title.trim();
    if (!t) return;
    const task = await addTask(t, date, startTime || null, endTime || null);
    setTasks((ts) =>
      [...ts, task].sort((a, b) =>
        (a.start_time ?? "99") < (b.start_time ?? "99") ? -1 : 1,
      ),
    );
    setTitle("");
    setStartTime("");
    setEndTime("");
  }

  async function handleToggle(task: PlanTask) {
    setTasks((ts) =>
      ts.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)),
    );
    await setTaskDone(task.id, !task.done);
  }

  async function handleDelete(id: string) {
    setTasks((ts) => ts.filter((t) => t.id !== id));
    await deleteTask(id);
  }

  const isToday = date === todayStr();

  return (
    <div className="p-6">
      {/* 日期导航 */}
      <div className="mb-4 flex items-center gap-2">
        <h1 className="mr-2 text-2xl font-semibold">计划表</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDate(addDays(date, -1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className={cn("min-w-28 text-center", isToday && "font-medium")}>
          {formatDateCn(date)}
          {isToday && "（今天）"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDate(addDays(date, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
        {!isToday && (
          <Button variant="outline" size="sm" onClick={() => setDate(todayStr())}>
            回到今天
          </Button>
        )}
      </div>

      {/* 添加任务 */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Input
          className="w-64"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="任务内容，如：写周报"
        />
        <Input
          type="time"
          className="w-28"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          title="开始时间（可选）"
        />
        <span className="text-muted-foreground">—</span>
        <Input
          type="time"
          className="w-28"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          title="结束时间（可选）"
        />
        <Button onClick={handleAdd}>
          <Plus className="size-4" /> 添加
        </Button>
      </div>

      {/* 任务列表 */}
      <div className="space-y-1.5">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="group flex items-center gap-3 rounded-md border px-3 py-2"
          >
            <Checkbox
              checked={task.done}
              onCheckedChange={() => handleToggle(task)}
              className="size-5"
            />
            {(task.start_time || task.end_time) && (
              <span className="w-24 text-sm text-muted-foreground">
                {task.start_time ?? "?"}
                {task.end_time && ` - ${task.end_time}`}
              </span>
            )}
            <span className={cn(task.done && "text-muted-foreground line-through")}>
              {task.title}
            </span>
            <button
              className="invisible ml-auto text-muted-foreground hover:text-destructive group-hover:visible"
              title="删除任务"
              onClick={() => handleDelete(task.id)}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>

      {tasks.length === 0 && (
        <p className="mt-8 text-muted-foreground">
          这一天还没有安排。在上方输入任务，可以附上时间段。
        </p>
      )}
    </div>
  );
}

const plannerModule: AppModule = {
  manifest: {
    id: "planner",
    name: "计划表",
    icon: CalendarDays,
    description: "日/周计划与时间块",
    defaultSize: { w: 2, h: 1 },
  },
  Card,
  Page,
};

export default plannerModule;
