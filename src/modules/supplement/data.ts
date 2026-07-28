import { getDb, newRecordFields, nowIso } from "@/lib/db";
import { todayStr } from "@/lib/dates";

/** 每日卡路里目标（存 app_settings，跨设备同步；默认 1400） */
export async function getCalTarget(): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM app_settings WHERE key = 'cal_target'",
  );
  return rows[0] ? Number(rows[0].value) : 1400;
}

export async function setCalTarget(v: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('cal_target', $1, $2)
     ON CONFLICT(key) DO UPDATE SET value = $1, updated_at = $2`,
    [String(v), nowIso()],
  );
}

/** 体重记录：按日期存 app_settings（key `weight:<date>:am|pm`），无需迁移、跨设备同步。
 *  空腹(am)/睡前(pm) 两个；空腹用于减重趋势。 */
export interface DayWeight {
  am: number | null;
  pm: number | null;
}
export async function getWeightLog(): Promise<Record<string, DayWeight>> {
  const db = await getDb();
  const rows = await db.select<{ key: string; value: string }[]>(
    "SELECT key, value FROM app_settings WHERE key LIKE 'weight:%'",
  );
  const m: Record<string, DayWeight> = {};
  for (const r of rows) {
    const [, date, slot] = r.key.split(":");
    if (!m[date]) m[date] = { am: null, pm: null };
    const v = r.value === "" ? null : Number(r.value);
    if (slot === "am") m[date].am = v;
    else if (slot === "pm") m[date].pm = v;
  }
  return m;
}
export async function setWeightEntry(date: string, slot: "am" | "pm", value: number | null): Promise<void> {
  const db = await getDb();
  const key = `weight:${date}:${slot}`;
  // 单调递增时间戳：防注入/其它设备的未来时间戳把这条盖回
  const prev = await db.select<{ updated_at: string }[]>(
    "SELECT updated_at FROM app_settings WHERE key = $1",
    [key],
  );
  const now = nowIso();
  const prevTs = prev[0]?.updated_at ?? "";
  const ts = now > prevTs ? now : new Date(Date.parse(prevTs) + 1000).toISOString();
  await db.execute(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT(key) DO UPDATE SET value = $2, updated_at = $3`,
    [key, value == null ? "" : String(value), ts],
  );
}

export type DrinkSubtype = "奶茶" | "果茶" | "酸奶";

/** 零食品类。⚠️ 零食**复用 `treat_log`**（2026-07-28 定：不建新表、零改库，Rosie 不用去 Supabase 跑 SQL）：
 *  用 `kind` 区分 'drink'/'snack'，`subtype` 存品类。附带好处是 `dayCalories` 不用改——
 *  它按 `subtype IS NOT NULL` 汇总 treat_log，零食热量自动算进当日总摄入。
 *  代价是表名叫 treat_log 却装着零食，名不正言不顺；真嫌乱以后再拆表。 */
export const SNACK_SUBTYPES = ["坚果", "酸奶", "黑巧", "水果", "其他"] as const;
export type SnackSubtype = (typeof SNACK_SUBTYPES)[number];

export interface Drink {
  id: string;
  date: string;
  subtype: DrinkSubtype;
  brand: string | null;
  name: string | null;
  sugar: string | null;
  calories: number | null;
}

export interface Snack {
  id: string;
  date: string;
  subtype: SnackSubtype;
  name: string | null;
  calories: number | null;
}

/** 记一杯饮品 */
export async function logDrink(d: {
  subtype: DrinkSubtype;
  brand?: string;
  name?: string;
  sugar?: string;
  calories?: number | null;
  date?: string;
}): Promise<void> {
  const db = await getDb();
  const f = newRecordFields();
  await db.execute(
    `INSERT INTO treat_log (id, kind, date, subtype, brand, name, sugar, calories, created_at, updated_at, device_id)
     VALUES ($1, 'drink', $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      f.id,
      d.date ?? todayStr(),
      d.subtype,
      d.brand ?? null,
      d.name ?? null,
      d.sugar ?? null,
      d.calories ?? null,
      f.created_at,
      f.updated_at,
      f.device_id,
    ],
  );
}

/** 记一笔零食（同一张 treat_log，kind='snack'） */
export async function logSnack(s: {
  subtype: SnackSubtype;
  name?: string;
  calories?: number | null;
  date?: string;
}): Promise<void> {
  const db = await getDb();
  const f = newRecordFields();
  await db.execute(
    `INSERT INTO treat_log (id, kind, date, subtype, brand, name, sugar, calories, created_at, updated_at, device_id)
     VALUES ($1, 'snack', $2, $3, NULL, $4, NULL, $5, $6, $7, $8)`,
    [
      f.id,
      s.date ?? todayStr(),
      s.subtype,
      s.name ?? null,
      s.calories ?? null,
      f.created_at,
      f.updated_at,
      f.device_id,
    ],
  );
}

/** 软删一条打卡——饮品和零食同一张表，所以共用 */
export async function deleteTreat(id: string): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  await db.execute("UPDATE treat_log SET deleted_at = $1, updated_at = $1 WHERE id = $2", [ts, id]);
}

/** 更新某杯的热量（我在对话里算完，你填数） */
export async function setDrinkCalories(id: string, cal: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE treat_log SET calories = $1, updated_at = $2 WHERE id = $3", [
    cal,
    nowIso(),
    id,
  ]);
}

/** 只取饮品。⚠️ 必须排掉 kind='snack'，否则零食会混进饮品列表和月历配色里；
 *  `kind IS NULL` 的老行（v7 时代只有奶茶）仍当饮品。 */
export async function listDrinks(sinceDate: string): Promise<Drink[]> {
  const db = await getDb();
  return db.select<Drink[]>(
    `SELECT id, date, subtype, brand, name, sugar, calories
     FROM treat_log
      WHERE deleted_at IS NULL AND subtype IS NOT NULL
        AND (kind IS NULL OR kind <> 'snack') AND date >= $1
      ORDER BY date DESC, created_at DESC`,
    [sinceDate],
  );
}

export async function listSnacks(sinceDate: string): Promise<Snack[]> {
  const db = await getDb();
  return db.select<Snack[]>(
    `SELECT id, date, subtype, name, calories
     FROM treat_log
      WHERE deleted_at IS NULL AND kind = 'snack' AND date >= $1
      ORDER BY date DESC, created_at DESC`,
    [sinceDate],
  );
}

// ---------- 三餐记录 ----------

export type MealKey = "早" | "午" | "晚";

export interface Meal {
  meal: MealKey;
  content: string | null;
  calories: number | null;
}

export async function getMeals(date: string): Promise<Record<MealKey, Meal>> {
  const db = await getDb();
  const rows = await db.select<{ meal: MealKey; content: string | null; calories: number | null }[]>(
    "SELECT meal, content, calories FROM meal_log WHERE date = $1 AND deleted_at IS NULL",
    [date],
  );
  const base: Record<MealKey, Meal> = {
    早: { meal: "早", content: null, calories: null },
    午: { meal: "午", content: null, calories: null },
    晚: { meal: "晚", content: null, calories: null },
  };
  for (const r of rows) base[r.meal] = { meal: r.meal, content: r.content, calories: r.calories };
  return base;
}

/** upsert 某天某餐（内容/热量任一改动都存） */
export async function setMeal(
  date: string,
  meal: MealKey,
  content: string,
  calories: number | null,
): Promise<void> {
  const db = await getDb();
  const existing = await db.select<{ id: string }[]>(
    "SELECT id FROM meal_log WHERE date = $1 AND meal = $2 AND deleted_at IS NULL",
    [date, meal],
  );
  const ts = nowIso();
  if (existing[0]) {
    await db.execute(
      "UPDATE meal_log SET content = $1, calories = $2, updated_at = $3 WHERE id = $4",
      [content || null, calories, ts, existing[0].id],
    );
  } else {
    const f = newRecordFields();
    await db.execute(
      `INSERT INTO meal_log (id, date, meal, content, calories, created_at, updated_at, device_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [f.id, date, meal, content || null, calories, f.created_at, f.updated_at, f.device_id],
    );
  }
}

/** 某天总热量（三餐 + 饮品 + 零食）。零食也在 treat_log 里且带 subtype，所以这句不用改就涵盖了 */
export async function dayCalories(date: string): Promise<number> {
  const db = await getDb();
  const meals = await db.select<{ c: number | null }[]>(
    "SELECT calories AS c FROM meal_log WHERE date = $1 AND deleted_at IS NULL",
    [date],
  );
  const drinks = await db.select<{ c: number | null }[]>(
    "SELECT calories AS c FROM treat_log WHERE date = $1 AND deleted_at IS NULL AND subtype IS NOT NULL",
    [date],
  );
  return [...meals, ...drinks].reduce((sum, r) => sum + (r.c ?? 0), 0);
}
