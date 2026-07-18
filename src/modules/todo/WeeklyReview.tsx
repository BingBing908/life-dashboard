import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { addDays, mondayOf, todayStr } from "@/lib/dates";
import { getCheckins, listHabits, type Habit } from "../habit-checkin/data";
import { countDoneBetween, listTodos } from "./data";

interface ReviewStats {
  monday: string;
  friday: string;
  doneCount: number;
  pendingToday: number;
  habits: { habit: Habit; days: number }[];
  /** 本周一到今天（最多到周五）已经过去的工作日数 */
  workdaysElapsed: number;
}

async function computeStats(): Promise<ReviewStats> {
  const today = todayStr();
  const monday = mondayOf(today);
  const friday = addDays(monday, 4);
  const saturday = addDays(monday, 5);

  const [doneCount, todos, habits, checkins] = await Promise.all([
    countDoneBetween(monday + "T00:00:00", saturday + "T00:00:00"),
    listTodos(),
    listHabits(),
    getCheckins(14),
  ]);

  const end = today < friday ? today : friday;
  let workdaysElapsed = 0;
  for (let d = monday; d <= end; d = addDays(d, 1)) workdaysElapsed++;

  const habitStats = habits.map((habit) => {
    const dates = checkins.get(habit.id) ?? new Set<string>();
    let days = 0;
    for (let d = monday; d <= friday; d = addDays(d, 1)) {
      if (dates.has(d)) days++;
    }
    return { habit, days };
  });

  return {
    monday,
    friday,
    doneCount,
    pendingToday: todos.filter((t) => !t.done && t.due_date && t.due_date <= today).length,
    habits: habitStats,
    workdaysElapsed,
  };
}

/** 周五 16:00 起到周日结束，视为"复盘时间" */
export function isReviewTime(): boolean {
  const now = new Date();
  const dow = now.getDay();
  if (dow === 6 || dow === 0) return true;
  return dow === 5 && now.getHours() >= 16;
}

function Bar({ ratio }: { ratio: number }) {
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.round(Math.min(1, ratio) * 100)}%` }}
      />
    </div>
  );
}

/** 周复盘对话框；trigger 由调用方决定（横幅按钮或页头小按钮） */
export function WeeklyReviewDialog({ trigger }: { trigger: React.ReactElement }) {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) computeStats().then(setStats);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>本周复盘（周一至周五）</DialogTitle>
        </DialogHeader>
        {stats === null ? (
          <p className="text-muted-foreground">统计中…</p>
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              {stats.monday.slice(5).replace("-", "/")} – {stats.friday.slice(5).replace("-", "/")}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">本周完成待办</p>
                <p className="text-2xl font-semibold">{stats.doneCount}</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">今天还挂着</p>
                <p className="text-2xl font-semibold">{stats.pendingToday}</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">打卡达成（{stats.workdaysElapsed} 个工作日）</p>
              {stats.habits.length === 0 && (
                <p className="text-sm text-muted-foreground">还没有打卡习惯。</p>
              )}
              <div className="space-y-2">
                {stats.habits.map(({ habit, days }) => (
                  <div key={habit.id} className="flex items-center gap-3 text-sm">
                    <span className="w-24 truncate">{habit.name}</span>
                    <Bar ratio={days / Math.max(1, stats.workdaysElapsed)} />
                    <span className="w-10 text-right text-muted-foreground">
                      {days}/{stats.workdaysElapsed}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** 周五 16:00 后显示在待办页顶部的横幅 */
export function ReviewBanner() {
  if (!isReviewTime()) return null;
  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg bg-accent px-4 py-2.5">
      <ClipboardList className="size-4 shrink-0 text-accent-foreground" />
      <p className="text-sm text-accent-foreground">
        <span className="font-medium">本周复盘已就绪</span>
        ——看看这周一到周五完成得怎么样
      </p>
      <WeeklyReviewDialog
        trigger={
          <Button variant="outline" size="sm" className="ml-auto shrink-0">
            查看复盘
          </Button>
        }
      />
    </div>
  );
}
