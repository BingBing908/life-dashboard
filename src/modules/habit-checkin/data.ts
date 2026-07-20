import { getDb, newRecordFields, nowIso, seedUuid } from "@/lib/db";
import { addDays, todayStr } from "@/lib/dates";

export interface Habit {
  id: string;
  name: string;
  /** '*'=每天 或 '1,2,3,4,5'（1=周一..7=周日） */
  days: string;
}

/** date -> 1..7（周一=1） */
export function dayNum(dateStr = todayStr()): number {
  const d = new Date(dateStr + "T00:00:00");
  return ((d.getDay() + 6) % 7) + 1;
}

export function habitOnDay(h: Habit, dNum: number): boolean {
  if (!h.days || h.days === "*") return true;
  return h.days.split(",").includes(String(dNum));
}

/** 首次使用的打卡清单：工作日微习惯 + 周末家务 */
const SEED_HABITS: { name: string; days: string }[] = [
  { name: "喝1杯水", days: "1,2,3,4,5" },
  { name: "喝2杯水", days: "1,2,3,4,5" },
  { name: "工作站立1次", days: "1,2,3,4,5" },
  { name: "工作站立2次", days: "1,2,3,4,5" },
  { name: "工作站立3次", days: "1,2,3,4,5" },
  { name: "工作站立4次", days: "1,2,3,4,5" },
  { name: "眼保健操1次", days: "1,2,3,4,5" },
  { name: "眼保健操2次", days: "1,2,3,4,5" },
  { name: "肩颈拉伸", days: "1,2,3,4,5" },
  { name: "午休", days: "1,2,3,4,5" },
  { name: "打扫卫生", days: "7" },
];

export async function listHabits(): Promise<Habit[]> {
  const db = await getDb();
  const rows = await db.select<{ id: string; name: string; days: string | null }[]>(
    "SELECT id, name, days FROM habits WHERE deleted_at IS NULL ORDER BY sort_order, created_at",
  );
  return rows.map((r) => ({ id: r.id, name: r.name, days: r.days ?? "*" }));
}

// StrictMode 并发守卫，避免种子插两份
let seedPromise: Promise<Habit[]> | null = null;

/** 首次使用时写入预置打卡清单 */
export function seedHabitsIfEmpty(): Promise<Habit[]> {
  if (!seedPromise) {
    seedPromise = (async () => {
      const existing = await listHabits();
      if (existing.length > 0) return existing;
      const db = await getDb();
      let order = 1;
      for (const s of SEED_HABITS) {
        const f = newRecordFields();
        // 确定性 id：按习惯名（已验证唯一）生成，任意设备一致 → 云同步去重（#25）
        const id = seedUuid(`habit:${s.name}`);
        await db.execute(
          "INSERT INTO habits (id, name, days, sort_order, created_at, updated_at, device_id) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [id, s.name, s.days, order++, f.created_at, f.updated_at, f.device_id],
        );
      }
      return listHabits();
    })();
  }
  return seedPromise;
}

export async function createHabit(name: string, days = "*"): Promise<Habit> {
  const db = await getDb();
  const f = newRecordFields();
  await db.execute(
    "INSERT INTO habits (id, name, days, sort_order, created_at, updated_at, device_id) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [f.id, name, days, 999, f.created_at, f.updated_at, f.device_id],
  );
  return { id: f.id, name, days };
}

export async function updateHabitName(id: string, name: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE habits SET name = $1, updated_at = $2 WHERE id = $3",
    [name, nowIso(), id],
  );
}

export async function deleteHabit(id: string): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  await db.execute(
    "UPDATE habits SET deleted_at = $1, updated_at = $1 WHERE id = $2",
    [ts, id],
  );
}

/** habit_id -> 已打卡日期集合（近 N 天） */
export async function getCheckins(days: number): Promise<Map<string, Set<string>>> {
  const db = await getDb();
  const since = addDays(todayStr(), -days);
  const rows = await db.select<{ habit_id: string; date: string }[]>(
    "SELECT habit_id, date FROM habit_checkins WHERE deleted_at IS NULL AND date >= $1",
    [since],
  );
  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!map.has(r.habit_id)) map.set(r.habit_id, new Set());
    map.get(r.habit_id)!.add(r.date);
  }
  return map;
}

/** 切换某习惯某天的打卡状态；返回切换后是否已打卡 */
export async function toggleCheckin(
  habitId: string,
  date: string,
): Promise<boolean> {
  const db = await getDb();
  const existing = await db.select<{ id: string; deleted_at: string | null }[]>(
    "SELECT id, deleted_at FROM habit_checkins WHERE habit_id = $1 AND date = $2",
    [habitId, date],
  );
  const ts = nowIso();
  if (existing.length === 0) {
    const f = newRecordFields();
    await db.execute(
      "INSERT INTO habit_checkins (id, habit_id, date, created_at, updated_at, device_id) VALUES ($1, $2, $3, $4, $5, $6)",
      [f.id, habitId, date, f.created_at, f.updated_at, f.device_id],
    );
    return true;
  }
  const row = existing[0];
  if (row.deleted_at) {
    await db.execute(
      "UPDATE habit_checkins SET deleted_at = NULL, updated_at = $1 WHERE id = $2",
      [ts, row.id],
    );
    return true;
  }
  await db.execute(
    "UPDATE habit_checkins SET deleted_at = $1, updated_at = $1 WHERE id = $2",
    [ts, row.id],
  );
  return false;
}

/** 从今天（或昨天）往前数连续打卡天数 */
export function calcStreak(dates: Set<string>): number {
  let day = todayStr();
  if (!dates.has(day)) day = addDays(day, -1);
  let streak = 0;
  while (dates.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}
