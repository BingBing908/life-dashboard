import { useCallback, useEffect, useState } from "react";
import { Check, CircleCheck, Flame, Plus, Repeat, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { EditableText } from "@/components/EditableText";
import { cn } from "@/lib/utils";
import { addDays, mondayOf, todayStr } from "@/lib/dates";
import type { AppModule } from "../types";
import {
  calcStreak,
  createHabit,
  dayNum,
  deleteHabit,
  getCheckins,
  habitOnDay,
  seedHabitsIfEmpty,
  toggleCheckin,
  updateHabitDays,
  updateHabitName,
  type Habit,
} from "./data";

const HISTORY_DAYS = 60;
const DAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"]; // 索引 0..6 对应周一..周日
// 重复星期快捷预设
const DAY_PRESETS: { label: string; days: string; set: number[] }[] = [
  { label: "每天", days: "*", set: [1, 2, 3, 4, 5, 6, 7] },
  { label: "工作日", days: "1,2,3,4,5", set: [1, 2, 3, 4, 5] },
  { label: "周末", days: "6,7", set: [6, 7] },
];

/** days 字符串转成人话：'*'→每天，'1,5,6,7'→一五六日 */
function daysLabel(days: string): string {
  if (!days || days === "*") return "每天";
  return days
    .split(",")
    .map((d) => DAY_LABELS[Number(d) - 1])
    .join("");
}

function useHabits() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [checkins, setCheckins] = useState<Map<string, Set<string>>>(new Map());
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const [hs, cs] = await Promise.all([seedHabitsIfEmpty(), getCheckins(HISTORY_DAYS)]);
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
  const today = todayStr();
  const todayHabits = habits.filter((h) => habitOnDay(h, dayNum(today)));
  if (todayHabits.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        今天没有打卡项。
      </p>
    );
  const done = todayHabits.filter((h) => checkins.get(h.id)?.has(today)).length;
  return (
    <p className="text-sm text-muted-foreground">
      今日已打卡 <span className="font-medium text-foreground">{done}</span> /{" "}
      {todayHabits.length}
    </p>
  );
}

/**
 * 打卡面板：可独立成页，也可嵌入其他模块（如 To Do List 右栏）。
 * compact = 窄栏模式：隐藏近 7 天方块和副标题，控件缩小。
 */
/** 一~日 七个星期方块（加习惯 / 改重复日共用），selected 里的高亮，点击 onToggle */
function WeekdayPicker({ selected, onToggle, size = "md" }: { selected: Set<number>; onToggle: (d: number) => void; size?: "sm" | "md" }) {
  return (
    <>
      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onToggle(d)}
          title={"周" + DAY_LABELS[d - 1]}
          className={cn(
            "flex items-center justify-center rounded-md border text-xs transition-colors",
            size === "sm" ? "size-6" : "size-7",
            selected.has(d)
              ? "border-primary bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent",
          )}
        >
          {DAY_LABELS[d - 1]}
        </button>
      ))}
    </>
  );
}

export function HabitPanel({ compact = false, weekly = false }: { compact?: boolean; weekly?: boolean }) {
  const { habits, setHabits, checkins, setCheckins, loaded } = useHabits();
  const [newName, setNewName] = useState("");
  // 新习惯的重复星期（默认每天全选）；空集=不能添加
  const [newDays, setNewDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6, 7]));
  const [addHint, setAddHint] = useState("");
  const [editDaysId, setEditDaysId] = useState<string | null>(null); // 正在改重复日的习惯
  const today = todayStr();
  // 只显示今天该打卡的（工作日/周末不同）
  const todayHabits = habits.filter((h) => habitOnDay(h, dayNum(today)));
  // 近 7 天，最左是 6 天前
  const recentDays = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  // 本周一~周日（周表格用）
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(mondayOf(today), i));

  function toggleNewDay(d: number) {
    setNewDays((prev) => {
      const n = new Set(prev);
      if (n.has(d)) n.delete(d);
      else n.add(d);
      return n;
    });
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name || newDays.size === 0) return;
    const daysStr =
      newDays.size === 7 ? "*" : [...newDays].sort((a, b) => a - b).join(",");
    const h = await createHabit(name, daysStr);
    setHabits((hs) => [...hs, h]);
    setNewName("");
    // 提示：若这个习惯今天不该打卡，列表里看不到，说一声免得以为没保存
    setAddHint(
      habitOnDay(h, dayNum(today))
        ? ""
        : `已添加「${name}」：每周${daysLabel(daysStr)}，今天不显示`,
    );
  }

  async function handleDelete(id: string) {
    setHabits((hs) => hs.filter((h) => h.id !== id));
    await deleteHabit(id);
  }

  async function handleRename(id: string, name: string) {
    setHabits((hs) => hs.map((h) => (h.id === id ? { ...h, name } : h)));
    await updateHabitName(id, name);
  }

  // 改某习惯的某个重复星期（至少保留一天）
  async function toggleHabitDay(habit: Habit, d: number) {
    const set =
      habit.days && habit.days !== "*"
        ? new Set(habit.days.split(",").map(Number))
        : new Set([1, 2, 3, 4, 5, 6, 7]);
    if (set.has(d)) set.delete(d);
    else set.add(d);
    if (set.size === 0) return;
    const daysStr = set.size === 7 ? "*" : [...set].sort((a, b) => a - b).join(",");
    setHabits((hs) => hs.map((h) => (h.id === habit.id ? { ...h, days: daysStr } : h)));
    await updateHabitDays(habit.id, daysStr);
  }

  // 快捷预设直接设某习惯的重复日（每天/工作日/周末）
  async function applyHabitDays(habit: Habit, days: string) {
    setHabits((hs) => hs.map((h) => (h.id === habit.id ? { ...h, days } : h)));
    await updateHabitDays(habit.id, days);
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

      <div className={cn(compact ? "mb-4" : "mb-6 max-w-sm")}>
        <div className="flex gap-2">
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
        {/* 快捷预设 */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {DAY_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setNewDays(new Set(p.set))}
              className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
            >
              {p.label}
            </button>
          ))}
        </div>
        {/* 重复星期：全选=每天；例如搓澡只选「日」，泡脚选一/五/六/日 */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <WeekdayPicker selected={newDays} onToggle={toggleNewDay} size={compact ? "sm" : "md"} />
          <span className="ml-1 text-xs text-muted-foreground">
            {newDays.size === 7 ? "每天" : newDays.size === 0 ? "选个星期" : `每周${daysLabel([...newDays].sort((a, b) => a - b).join(","))}`}
          </span>
        </div>
        {addHint && <p className="mt-1.5 text-xs text-primary">{addHint}</p>}
      </div>

      {weekly && (
        <div className="space-y-1">
          {/* 表头：本周一~日 */}
          <div className="flex items-center gap-1 pb-1">
            <span className="min-w-0 flex-1" />
            {weekDates.map((d, i) => (
              <span
                key={d}
                className={cn(
                  "w-7 text-center text-xs",
                  d === today ? "font-medium text-primary" : "text-muted-foreground",
                )}
              >
                {DAY_LABELS[i]}
              </span>
            ))}
            <span className="w-10" />
          </div>
          {habits.map((habit) => {
            const dates = checkins.get(habit.id) ?? new Set<string>();
            const editing = editDaysId === habit.id;
            const habitDaySet =
              habit.days && habit.days !== "*"
                ? new Set(habit.days.split(",").map(Number))
                : new Set([1, 2, 3, 4, 5, 6, 7]);
            return (
              <div key={habit.id}>
                <div className="group flex items-center gap-1">
                  <EditableText
                    value={habit.name}
                    onSave={(v) => handleRename(habit.id, v)}
                    className="min-w-0 flex-1 truncate text-sm"
                    inputClassName="flex-1 text-sm"
                  />
                  {weekDates.map((d, i) => {
                    const applies = habitOnDay(habit, i + 1);
                    const checked = dates.has(d);
                    const disabled = d > today && !checked; // 未来未打卡不可点
                    if (!applies) {
                      return (
                        <span key={d} className="flex w-7 justify-center text-muted-foreground/30" title="这天不排这条">
                          ·
                        </span>
                      );
                    }
                    return (
                      <button
                        key={d}
                        disabled={disabled}
                        onClick={() => handleToggle(habit.id, d)}
                        title={d}
                        className={cn(
                          "flex size-7 items-center justify-center rounded-md border transition-colors",
                          checked
                            ? "border-primary bg-primary text-primary-foreground"
                            : disabled
                              ? "border-dashed opacity-40"
                              : "hover:bg-accent",
                          d === today && !checked && "ring-2 ring-primary/30",
                        )}
                      >
                        {checked && <Check className="size-3.5" />}
                      </button>
                    );
                  })}
                  <button
                    className={cn(
                      "w-5 shrink-0",
                      editing ? "text-primary" : "text-muted-foreground hover:text-foreground",
                    )}
                    title="改重复星期"
                    onClick={() => setEditDaysId(editing ? null : habit.id)}
                  >
                    <Repeat className="size-3.5" />
                  </button>
                  <button
                    className="invisible w-5 shrink-0 text-muted-foreground hover:text-destructive group-hover:visible"
                    title="删除习惯"
                    onClick={() => handleDelete(habit.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                {editing && (
                  <div className="mb-2 mt-1 flex flex-wrap items-center gap-1 pl-1">
                    <span className="text-xs text-muted-foreground">重复：</span>
                    {DAY_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => applyHabitDays(habit, p.days)}
                        className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
                      >
                        {p.label}
                      </button>
                    ))}
                    <span className="mx-0.5 text-muted-foreground/40">|</span>
                    <WeekdayPicker selected={habitDaySet} onToggle={(d) => toggleHabitDay(habit, d)} size="sm" />
                    <span className="ml-1 text-xs text-muted-foreground">{daysLabel(habit.days)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!weekly && (
      <div className={cn(compact ? "space-y-1" : "space-y-2")}>
        {todayHabits.map((habit) => {
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
                  "min-w-0 truncate",
                  compact ? "text-sm" : "min-w-24 font-medium",
                )}
                inputClassName={cn("flex-1", compact ? "text-sm" : "font-medium")}
              />
              {habit.days && habit.days !== "*" ? (
                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {daysLabel(habit.days)}
                </span>
              ) : null}
              <span className="flex-1" />

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
      )}

      {loaded && (weekly ? habits.length === 0 : todayHabits.length === 0) && (
        <p className={cn("text-muted-foreground", compact ? "mt-4 text-sm" : "mt-8")}>
          {weekly ? "还没有打卡项，上面添加。" : "今天没有打卡项。"}
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
