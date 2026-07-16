import { useCallback, useEffect, useState } from "react";
import { CircleCheck, Flame, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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

function Page() {
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
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-semibold">打卡</h1>

      <div className="mb-6 flex max-w-sm gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="新习惯，如：早睡、背单词"
        />
        <Button onClick={handleCreate}>
          <Plus className="size-4" /> 添加
        </Button>
      </div>

      <div className="space-y-2">
        {habits.map((habit) => {
          const dates = checkins.get(habit.id) ?? new Set<string>();
          const streak = calcStreak(dates);
          return (
            <div
              key={habit.id}
              className="group flex items-center gap-4 rounded-lg border p-3"
            >
              <Checkbox
                checked={dates.has(today)}
                onCheckedChange={() => handleToggle(habit.id, today)}
                className="size-5"
              />
              <span className="min-w-24 font-medium">{habit.name}</span>

              {streak > 0 && (
                <span className="flex items-center gap-1 text-sm text-orange-500">
                  <Flame className="size-4" />
                  连续 {streak} 天
                </span>
              )}

              {/* 近 7 天小方块，点击可补卡/取消 */}
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

              <button
                className="invisible text-muted-foreground hover:text-destructive group-hover:visible"
                title="删除习惯"
                onClick={() => handleDelete(habit.id)}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          );
        })}
      </div>

      {loaded && habits.length === 0 && (
        <p className="mt-8 text-muted-foreground">
          还没有习惯。在上方添加第一个打卡项，比如「早睡」「运动」。
        </p>
      )}
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
