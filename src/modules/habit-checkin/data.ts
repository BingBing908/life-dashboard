import { getDb, newRecordFields, nowIso } from "@/lib/db";
import { addDays, todayStr } from "@/lib/dates";

export interface Habit {
  id: string;
  name: string;
}

export async function listHabits(): Promise<Habit[]> {
  const db = await getDb();
  return db.select<Habit[]>(
    "SELECT id, name FROM habits WHERE deleted_at IS NULL ORDER BY created_at",
  );
}

export async function createHabit(name: string): Promise<Habit> {
  const db = await getDb();
  const f = newRecordFields();
  await db.execute(
    "INSERT INTO habits (id, name, created_at, updated_at, device_id) VALUES ($1, $2, $3, $4, $5)",
    [f.id, name, f.created_at, f.updated_at, f.device_id],
  );
  return { id: f.id, name };
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
