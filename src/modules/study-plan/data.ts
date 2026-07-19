import { getDb, newRecordFields, nowIso } from "@/lib/db";
import { mondayOf, todayStr } from "@/lib/dates";
import { SEED_ITEMS, SEED_VERSION } from "./seed";

/** 六条线：养生 / 运动 / 英语 / HCIP / AI方向 / 阅读 */
export type Track = "wellness" | "sport" | "english" | "cert" | "ai" | "reading";

export const TRACKS: { key: Track; name: string }[] = [
  { key: "wellness", name: "养生" },
  { key: "sport", name: "运动" },
  { key: "english", name: "英语" },
  { key: "cert", name: "HCIP" },
  { key: "ai", name: "AI方向" },
  { key: "reading", name: "阅读" },
];

export interface PlanItem {
  id: string;
  track: Track;
  /** '*'=每天，或 '1,3,5'（1=周一..7=周日） */
  days: string;
  time_slot: string | null;
  title: string;
  detail: string | null;
  url: string | null;
  /** 经期处理：null/''=不受影响；'skip'=经期隐藏；'swap'=经期换成 period_title/detail */
  period_action: string | null;
  period_title: string | null;
  period_detail: string | null;
  sort_order: number;
}

/** date -> 1..7（周一=1） */
export function dayNumOf(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  return ((d.getDay() + 6) % 7) + 1;
}

export function matchesDay(item: PlanItem, dayNum: number): boolean {
  if (item.days === "*") return true;
  return item.days.split(",").includes(String(dayNum));
}

export async function listItems(): Promise<PlanItem[]> {
  const db = await getDb();
  return db.select<PlanItem[]>(
    `SELECT id, track, days, time_slot, title, detail, url, period_action, period_title, period_detail, sort_order
     FROM plan_items WHERE deleted_at IS NULL ORDER BY time_slot, sort_order`,
  );
}

// 并发守卫：React StrictMode 在开发模式会把 effect 跑两遍，
// 两次并发的"查空→插种子"会各插一份；用单例 Promise 确保只播种一次。
let seedPromise: Promise<PlanItem[]> | null = null;

/** 首次使用时写入种子计划，并把周期起点定为本周一 */
export function seedIfEmpty(): Promise<PlanItem[]> {
  if (!seedPromise) {
    seedPromise = (async () => {
      const existing = await listItems();
      if (existing.length > 0) return existing;
      const db = await getDb();
      let order = 1;
      for (const s of SEED_ITEMS) {
        const f = newRecordFields();
        await db.execute(
          `INSERT INTO plan_items (id, track, days, time_slot, title, detail, url, period_action, period_title, period_detail, sort_order, created_at, updated_at, device_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [f.id, s.track, s.days, s.time_slot, s.title, s.detail ?? null, s.url ?? null, s.period_action ?? null, s.period_title ?? null, s.period_detail ?? null, order++, f.created_at, f.updated_at, f.device_id],
        );
      }
      await setCycleStart(mondayOf(todayStr()));
      await setSeedVersion(SEED_VERSION);
      return listItems();
    })();
  }
  return seedPromise;
}

/** 已播种的模板版本；0 = 从未记录（老库） */
export async function getSeedVersion(): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM app_settings WHERE key = 'plan_seed_version'",
  );
  return rows[0] ? Number(rows[0].value) : 0;
}

async function setSeedVersion(v: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('plan_seed_version', $1, $2)
     ON CONFLICT(key) DO UPDATE SET value = $1, updated_at = $2`,
    [String(v), nowIso()],
  );
}

/** 当前代码里的模板版本（供 UI 比对） */
export function latestSeedVersion(): number {
  return SEED_VERSION;
}

/** 清空现有条目并重新播种（用于同步最新计划模板；已打的勾会失效） */
export async function resetToSeed(): Promise<PlanItem[]> {
  const db = await getDb();
  const ts = nowIso();
  await db.execute(
    "UPDATE plan_items SET deleted_at = $1, updated_at = $1 WHERE deleted_at IS NULL",
    [ts],
  );
  seedPromise = null;
  const items = await seedIfEmpty();
  await setSeedVersion(SEED_VERSION);
  return items;
}

export async function createItem(
  fields: Pick<PlanItem, "track" | "days" | "time_slot" | "title"> & { url?: string | null },
  sortOrder: number,
): Promise<PlanItem> {
  const db = await getDb();
  const f = newRecordFields();
  await db.execute(
    `INSERT INTO plan_items (id, track, days, time_slot, title, url, sort_order, created_at, updated_at, device_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [f.id, fields.track, fields.days, fields.time_slot, fields.title, fields.url ?? null, sortOrder, f.created_at, f.updated_at, f.device_id],
  );
  return {
    id: f.id,
    track: fields.track,
    days: fields.days,
    time_slot: fields.time_slot,
    title: fields.title,
    detail: null,
    url: fields.url ?? null,
    period_action: null,
    period_title: null,
    period_detail: null,
    sort_order: sortOrder,
  };
}

/** 经期开关是否打开 */
export async function getPeriodOn(): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM app_settings WHERE key = 'plan_period_on'",
  );
  return rows[0]?.value === "1";
}

export async function setPeriodOn(on: boolean): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('plan_period_on', $1, $2)
     ON CONFLICT(key) DO UPDATE SET value = $1, updated_at = $2`,
    [on ? "1" : "0", nowIso()],
  );
}

/**
 * 经期视图变换：开关打开时，
 * 'skip' 条目返回 null（隐藏），'swap' 条目替换标题/备注。
 */
export function applyPeriod(item: PlanItem, periodOn: boolean): PlanItem | null {
  if (!periodOn || !item.period_action) return item;
  if (item.period_action === "skip") return null;
  if (item.period_action === "swap") {
    return {
      ...item,
      title: item.period_title || item.title,
      detail: item.period_detail || item.detail,
    };
  }
  return item;
}

export async function updateItemTitle(id: string, title: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE plan_items SET title = $1, updated_at = $2 WHERE id = $3", [
    title,
    nowIso(),
    id,
  ]);
}

export async function updateItemDetail(id: string, detail: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE plan_items SET detail = $1, updated_at = $2 WHERE id = $3", [
    detail,
    nowIso(),
    id,
  ]);
}

export async function deleteItem(id: string): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  await db.execute("UPDATE plan_items SET deleted_at = $1, updated_at = $1 WHERE id = $2", [ts, id]);
}

/** 某天已完成的条目 id 集合 */
export async function listChecks(date: string): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.select<{ item_id: string }[]>(
    "SELECT item_id FROM plan_checks WHERE date = $1 AND deleted_at IS NULL",
    [date],
  );
  return new Set(rows.map((r) => r.item_id));
}

/** 切换完成状态；返回切换后是否已完成 */
export async function toggleCheck(itemId: string, date: string): Promise<boolean> {
  const db = await getDb();
  const existing = await db.select<{ id: string; deleted_at: string | null }[]>(
    "SELECT id, deleted_at FROM plan_checks WHERE item_id = $1 AND date = $2",
    [itemId, date],
  );
  const ts = nowIso();
  if (existing.length === 0) {
    const f = newRecordFields();
    await db.execute(
      "INSERT INTO plan_checks (id, item_id, date, created_at, updated_at, device_id) VALUES ($1, $2, $3, $4, $5, $6)",
      [f.id, itemId, date, f.created_at, f.updated_at, f.device_id],
    );
    return true;
  }
  const row = existing[0];
  if (row.deleted_at) {
    await db.execute("UPDATE plan_checks SET deleted_at = NULL, updated_at = $1 WHERE id = $2", [ts, row.id]);
    return true;
  }
  await db.execute("UPDATE plan_checks SET deleted_at = $1, updated_at = $1 WHERE id = $2", [ts, row.id]);
  return false;
}

// ---------- 4 周递进周期 ----------

export const CYCLE_PHASES = [
  "适应周：跟练做 2/3 量即可",
  "完整周：足量跟完",
  "加量周：心肺日 +10 分钟",
  "减载周：恢复为主，评估体感",
];

export async function getCycleStart(): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM app_settings WHERE key = 'plan_cycle_start'",
  );
  return rows[0]?.value ?? null;
}

export async function setCycleStart(date: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('plan_cycle_start', $1, $2)
     ON CONFLICT(key) DO UPDATE SET value = $1, updated_at = $2`,
    [date, nowIso()],
  );
}

/** 当前处于 4 周周期的第几周（1-4） */
export function cycleWeekOf(cycleStart: string, today: string): number {
  const ms = new Date(today + "T00:00:00").getTime() - new Date(cycleStart + "T00:00:00").getTime();
  const weeks = Math.max(0, Math.floor(ms / (7 * 24 * 3600 * 1000)));
  return (weeks % 4) + 1;
}
