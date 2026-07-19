import { getDb, newRecordFields, nowIso } from "@/lib/db";
import { todayStr } from "@/lib/dates";

export type DrinkSubtype = "奶茶" | "果茶" | "酸奶";

export interface Drink {
  id: string;
  date: string;
  subtype: DrinkSubtype;
  brand: string | null;
  name: string | null;
  sugar: string | null;
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

export async function deleteDrink(id: string): Promise<void> {
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

export async function listDrinks(sinceDate: string): Promise<Drink[]> {
  const db = await getDb();
  return db.select<Drink[]>(
    `SELECT id, date, subtype, brand, name, sugar, calories
     FROM treat_log WHERE deleted_at IS NULL AND subtype IS NOT NULL AND date >= $1
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

/** 某天总热量（三餐 + 饮品） */
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
