import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { addDays, formatDateCn, mondayOf, todayStr } from "@/lib/dates";
import type { AppModule } from "../types";
import {
  addTask,
  deleteTask,
  listTasksBetween,
  setTaskDone,
  updateTask,
  type PlanTask,
} from "./data";
import { MiniCalendar } from "./MiniCalendar";

const HOUR_PX = 40;
const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** 时间块的顶部偏移与高度（无结束时间按 1 小时画） */
function blockGeom(task: PlanTask) {
  const start = timeToMin(task.start_time!);
  const end = task.end_time ? timeToMin(task.end_time) : start + 60;
  const top = (start / 60) * HOUR_PX;
  const height = Math.max(18, ((end - start) / 60) * HOUR_PX - 2);
  return { top, height };
}

interface DialogState {
  open: boolean;
  task: PlanTask | null; // null = 新建
  date: string;
  title: string;
  start: string;
  end: string;
}

const closedDialog: DialogState = {
  open: false,
  task: null,
  date: "",
  title: "",
  start: "",
  end: "",
};

function Card() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const today = todayStr();
    listTasksBetween(today, today)
      .then((tasks) => {
        const pending = tasks.filter((t) => !t.done);
        if (tasks.length === 0) setText("今日暂无计划，点击进入安排。");
        else if (pending.length === 0) setText(`今日 ${tasks.length} 项计划全部完成 ✨`);
        else {
          const next = pending.find((t) => t.start_time);
          setText(
            `今日还剩 ${pending.length} 项` +
              (next ? `，下一项 ${next.start_time} ${next.title}` : ""),
          );
        }
      })
      .catch(() => setText("今日暂无计划，点击进入安排。"));
  }, []);

  return <p className="text-sm text-muted-foreground">{text ?? "加载中…"}</p>;
}

function Page() {
  const [selected, setSelected] = useState(todayStr());
  const [mode, setMode] = useState<"day" | "week">("day");
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [dlg, setDlg] = useState<DialogState>(closedDialog);
  const today = todayStr();

  const days = useMemo(() => {
    if (mode === "day") return [selected];
    const mon = mondayOf(selected);
    return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  }, [selected, mode]);

  const reload = useCallback(() => {
    listTasksBetween(days[0], days[days.length - 1]).then(setTasks);
  }, [days]);

  useEffect(() => {
    reload();
  }, [reload]);

  const byDate = useMemo(() => {
    const m = new Map<string, PlanTask[]>();
    for (const t of tasks) {
      if (!m.has(t.date)) m.set(t.date, []);
      m.get(t.date)!.push(t);
    }
    return m;
  }, [tasks]);

  function openCreate(date: string, hour?: number) {
    setDlg({
      open: true,
      task: null,
      date,
      title: "",
      start: hour === undefined ? "" : `${String(hour).padStart(2, "0")}:00`,
      end: hour === undefined ? "" : `${String(Math.min(hour + 1, 23)).padStart(2, "0")}:59` ,
    });
  }

  function openEdit(task: PlanTask) {
    setDlg({
      open: true,
      task,
      date: task.date,
      title: task.title,
      start: task.start_time ?? "",
      end: task.end_time ?? "",
    });
  }

  async function handleSave() {
    const title = dlg.title.trim();
    if (!title) return;
    const start = dlg.start || null;
    const end = dlg.end || null;
    if (dlg.task) {
      await updateTask(dlg.task.id, { title, startTime: start, endTime: end });
    } else {
      await addTask(title, dlg.date, start, end);
    }
    setDlg(closedDialog);
    reload();
  }

  async function handleDelete() {
    if (dlg.task) {
      await deleteTask(dlg.task.id);
      setDlg(closedDialog);
      reload();
    }
  }

  async function handleToggleDone(task: PlanTask) {
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)));
    await setTaskDone(task.id, !task.done);
  }

  function onColumnClick(date: string, e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("[data-task]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const hour = Math.floor((e.clientY - rect.top) / HOUR_PX);
    openCreate(date, Math.min(23, Math.max(0, hour)));
  }

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const gutter = 44;

  return (
    <div className="p-6">
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_270px]">
        {/* 左：时间轴 */}
        <section className="rounded-xl border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <h2 className="text-lg font-semibold">
              {mode === "day"
                ? formatDateCn(selected)
                : `${days[0].slice(5).replace("-", "/")} – ${days[6].slice(5).replace("-", "/")}`}
            </h2>
            <div className="ml-auto flex items-center gap-1.5">
              <Button variant="outline" size="icon-sm" title="前一天/周"
                onClick={() => setSelected(addDays(selected, mode === "day" ? -1 : -7))}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelected(today)}>
                今天
              </Button>
              <Button variant="outline" size="icon-sm" title="后一天/周"
                onClick={() => setSelected(addDays(selected, mode === "day" ? 1 : 7))}>
                <ChevronRight className="size-4" />
              </Button>
              <div className="ml-2 flex overflow-hidden rounded-md border">
                {(["day", "week"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={cn(
                      "px-3 py-1 text-sm transition-colors",
                      mode === m ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                    )}
                  >
                    {m === "day" ? "日" : "周"}
                  </button>
                ))}
              </div>
              <Button size="sm" className="ml-2" onClick={() => openCreate(selected)}>
                添加计划
              </Button>
            </div>
          </div>

          {/* 周视图的星期表头 */}
          {mode === "week" && (
            <div className="flex border-b" style={{ paddingLeft: gutter }}>
              {days.map((d, i) => (
                <button
                  key={d}
                  onClick={() => {
                    setSelected(d);
                    setMode("day");
                  }}
                  className={cn(
                    "flex-1 py-1.5 text-center text-xs transition-colors hover:bg-accent",
                    d === today ? "font-semibold text-primary" : "text-muted-foreground",
                  )}
                >
                  周{WEEKDAYS[i]} {Number(d.slice(8))}
                </button>
              ))}
            </div>
          )}

          {/* 未定时任务 */}
          <UntimedStrip
            days={days}
            byDate={byDate}
            gutter={gutter}
            onToggle={handleToggleDone}
            onEdit={openEdit}
          />

          {/* 时间网格 */}
          <div className="relative m-3 mt-1" style={{ height: 24 * HOUR_PX }}>
            {Array.from({ length: 25 }, (_, h) => (
              <div key={h}>
                <div
                  className="absolute right-0 border-t border-border"
                  style={{ top: h * HOUR_PX, left: gutter }}
                />
                {h < 24 && (
                  <span
                    className="absolute text-[10px] text-muted-foreground"
                    style={{ top: h * HOUR_PX - 7, left: 0, width: gutter - 8, textAlign: "right" }}
                  >
                    {String(h).padStart(2, "0")}:00
                  </span>
                )}
              </div>
            ))}

            <div className="absolute inset-y-0 flex" style={{ left: gutter, right: 0 }}>
              {days.map((d, i) => (
                <div
                  key={d}
                  className={cn("relative h-full flex-1 cursor-pointer", i > 0 && "border-l")}
                  onClick={(e) => onColumnClick(d, e)}
                >
                  {(byDate.get(d) ?? [])
                    .filter((t) => t.start_time)
                    .map((t) => {
                      const { top, height } = blockGeom(t);
                      return (
                        <div
                          key={t.id}
                          data-task
                          onClick={() => openEdit(t)}
                          className={cn(
                            "absolute inset-x-0.5 z-10 overflow-hidden rounded-r-md border-l-2 px-1.5 py-0.5",
                            t.done
                              ? "border-muted-foreground/40 bg-muted text-muted-foreground line-through"
                              : "border-primary bg-accent text-accent-foreground",
                          )}
                          style={{ top, height }}
                        >
                          <p className="truncate text-xs font-medium">{t.title}</p>
                          {height >= 34 && (
                            <p className="truncate text-[10px] opacity-75">
                              {t.start_time}
                              {t.end_time && ` – ${t.end_time}`}
                            </p>
                          )}
                        </div>
                      );
                    })}

                  {/* 当前时刻红线 */}
                  {d === today && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-red-500"
                      style={{ top: (nowMin / 60) * HOUR_PX }}
                    >
                      <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-red-500" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 右：小月历 */}
        <div className="space-y-4 xl:sticky xl:top-6">
          <MiniCalendar
            selected={selected}
            onSelect={(d) => {
              setSelected(d);
              setMode("day");
            }}
          />
          <p className="px-1 text-xs text-muted-foreground">
            点时间轴空白处，在那个时段插入计划；点已有的计划块可以编辑或删除。
          </p>
        </div>
      </div>

      {/* 新建/编辑弹窗 */}
      <Dialog open={dlg.open} onOpenChange={(o) => !o && setDlg(closedDialog)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dlg.task ? "编辑计划" : "新建计划"} · {dlg.date && formatDateCn(dlg.date)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              value={dlg.title}
              onChange={(e) => setDlg({ ...dlg, title: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="做什么？"
            />
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={dlg.start}
                onChange={(e) => setDlg({ ...dlg, start: e.target.value })}
                className="w-32"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="time"
                value={dlg.end}
                onChange={(e) => setDlg({ ...dlg, end: e.target.value })}
                className="w-32"
              />
              {(dlg.start || dlg.end) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDlg({ ...dlg, start: "", end: "" })}
                >
                  清除时间
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">不填时间就是「当天待安排」，会显示在时间轴上方。</p>
          </div>
          <DialogFooter>
            {dlg.task && (
              <Button variant="ghost" className="mr-auto text-destructive" onClick={handleDelete}>
                <Trash2 className="size-4" /> 删除
              </Button>
            )}
            <Button variant="outline" onClick={() => setDlg(closedDialog)}>
              取消
            </Button>
            <Button onClick={handleSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** 时间轴上方的「未定时」任务条 */
function UntimedStrip({
  days,
  byDate,
  gutter,
  onToggle,
  onEdit,
}: {
  days: string[];
  byDate: Map<string, PlanTask[]>;
  gutter: number;
  onToggle: (t: PlanTask) => void;
  onEdit: (t: PlanTask) => void;
}) {
  const has = days.some((d) => (byDate.get(d) ?? []).some((t) => !t.start_time));
  if (!has) return null;
  return (
    <div className="flex border-b bg-muted/40" style={{ paddingLeft: gutter }}>
      {days.map((d, i) => (
        <div key={d} className={cn("min-w-0 flex-1 space-y-1 p-1.5", i > 0 && "border-l")}>
          {(byDate.get(d) ?? [])
            .filter((t) => !t.start_time)
            .map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1"
              >
                <Checkbox
                  checked={t.done}
                  onCheckedChange={() => onToggle(t)}
                  className="size-3.5"
                />
                <button
                  className={cn(
                    "min-w-0 flex-1 truncate text-left text-xs",
                    t.done && "text-muted-foreground line-through",
                  )}
                  onClick={() => onEdit(t)}
                >
                  {t.title}
                </button>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

const plannerModule: AppModule = {
  manifest: {
    id: "planner",
    name: "计划表",
    icon: CalendarDays,
    description: "日历式计划：日/周时间轴 + 小月历",
    defaultSize: { w: 2, h: 1 },
  },
  Card,
  Page,
};

export default plannerModule;
