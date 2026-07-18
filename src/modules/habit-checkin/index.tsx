import { useCallback, useEffect, useState } from "react";
import { CircleCheck, Flame, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { EditableText } from "@/components/EditableText";
import { cn } from "@/lib/utils";
import { addDays, todayStr } from "@/lib/dates";
import type { AppModule } from "../types";
import {
  calcStreak,
  createHabit,
  deleteHabit,
  getCheckins,
  listHabits,
  toggleCheckin,
  updateHabitName,
  type Habit,
} from "./data";

const HISTORY_DAYS = 60;

function useHabits() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [checkins, setCheckins] = useState<Map<string, Set<string>>>(new Map());
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const [hs, cs] = await Promise.all([listHabits(), getCheckins(HISTORY_DAYS)]);
    setHabits(hs);
    setCheckins(cs);
    setLoaded(true);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { habits, setHabits, checkins, setCheckins, loaded, reload };
}

function Card() {
  const { habits, checkins, loaded } = useHabits();
  if (!loaded) return <p className="text-sm text-muted-foreground">加载中…</p>;
  if (habits.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        还没有习惯，点击创建第一个打卡项。
      </p>
    );
  const today = todayStr();
  const done = habits.filter((h) => checkins.get(h.id)?.has(today)).length;
  return (
    <p className="text-sm text-muted-foreground">
      今日已打卡 <span className="font-medium text-foreground">{done}</span> /{" "}
      {habits.length}
    </p>
  );
}

/**
 * 打卡面板：可独立成页，也可嵌入其他模块（如 To Do List 右栏）。
 * compact = 窄栏模式：隐藏近 7 天方块和副标题，控件缩小。
 */
export function HabitPanel({ compact = false }: { compact?: boolean }) {
  const { habits, setHabits, checkins, setCheckins, loaded } = useHabits();
  const [newName, setNewName] = useState("");
  const today = todayStr();
  // 近 7 天，最左是 6 天前
  const recentDays = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    const h = await createHabit(name);
    setHabits((hs) => [...hs, h]);
    setNewName("");
  }

  async function handleDelete(id: string) {
    setHabits((hs) => hs.filter((h) => h.id !== id));
    await deleteHabit(id);
  }

  async function handleRename(id: string, name: string) {
    setHabits((hs) => hs.map((h) => (h.id === id ? { ...h, name } : h)));
    await updateHabitName(id, name);
  }

  async function handleToggle(habitId: string, date: string) {
    const checked = await toggleCheckin(habitId, date);
    setCheckins((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(habitId) ?? []);
      if (checked) set.add(date);
      else set.delete(date);
      next.set(habitId, set);
      return next;
    });
  }

  return (
    <section>
      <div className={cn("flex items-baseline gap-3", compact ? "mb-3" : "mb-4")}>
        <h2 className={cn("font-semibold", compact ? "text-lg" : "text-xl")}>打卡</h2>
        {!compact && <span className="text-sm text-muted-foreground">每天例行要做的</span>}
      </div>

      <div className={cn("flex gap-2", compact ? "mb-4" : "mb-6 max-w-sm")}>
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder={compact ? "新习惯" : "新习惯，如：早睡、背单词"}
          className={cn(compact && "h-8 text-sm")}
        />
        <Button size={compact ? "icon-sm" : "default"} onClick={handleCreate}>
          <Plus className="size-4" />
          {!compact && " 添加"}
        </Button>
      </div>

      <div className={cn(compact ? "space-y-1" : "space-y-2")}>
        {habits.map((habit) => {
          const dates = checkins.get(habit.id) ?? new Set<string>();
          const streak = calcStreak(dates);
          return (
            <div
              key={habit.id}
              className={cn(
                "group flex items-center rounded-lg border",
                compact ? "gap-2 px-2 py-1.5" : "gap-4 p-3",
              )}
            >
              <Checkbox
                checked={dates.has(today)}
                onCheckedChange={() => handleToggle(habit.id, today)}
                className={cn(compact ? "size-4" : "size-5")}
              />
              <EditableText
                value={habit.name}
                onSave={(v) => handleRename(habit.id, v)}
                className={cn(
                  "min-w-0 flex-1 truncate",
                  compact ? "text-sm" : "min-w-24 font-medium",
                )}
                inputClassName={cn("flex-1", compact ? "text-sm" : "font-medium")}
              />

              {streak > 0 && (
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-0.5 text-orange-500",
                    compact ? "text-xs" : "gap-1 text-sm",
                  )}
                >
                  <Flame className={cn(compact ? "size-3.5" : "size-4")} />
                  {compact ? streak : `连续 ${streak} 天`}
                </span>
              )}

              {/* 近 7 天小方块，点击可补卡/取消（窄栏模式下隐藏） */}
              {!compact && (
                <div className="ml-auto flex gap-1">
                  {recentDays.map((d) => (
                    <button
                      key={d}
                      title={d}
                      onClick={() => handleToggle(habit.id, d)}
                      className={cn(
                        "size-5 rounded-sm border transition-colors",
                        dates.has(d)
                          ? "border-primary bg-primary"
                          : "bg-muted hover:bg-accent",
                        d === today && "ring-2 ring-ring/40",
                      )}
                    />
                  ))}
                </div>
              )}

              <button
                className="invisible shrink-0 text-muted-foreground hover:text-destructive group-hover:visible"
                title="删除习惯"
                onClick={() => handleDelete(habit.id)}
              >
                <Trash2 className={cn(compact ? "size-3.5" : "size-4")} />
              </button>
            </div>
          );
        })}
      </div>

      {loaded && habits.length === 0 && (
        <p className={cn("text-muted-foreground", compact ? "mt-4 text-sm" : "mt-8")}>
          {compact ? "还没有习惯，先加一个。" : "还没有习惯。在上方添加第一个打卡项，比如「早睡」「运动」。"}
        </p>
      )}
    </section>
  );
}

function Page() {
  return (
    <div className="p-6">
      <HabitPanel />
    </div>
  );
}

const habitCheckinModule: AppModule = {
  manifest: {
    id: "habit-checkin",
    name: "打卡",
    icon: CircleCheck,
    description: "习惯打卡与连续天数",
    defaultSize: { w: 1, h: 1 },
  },
  Card,
  Page,
};

export default habitCheckinModule;
