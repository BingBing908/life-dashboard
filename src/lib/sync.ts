import { getDb } from "./db";
import { supabase } from "./supabase";

/**
 * 云端同步（档位 A：无登录 / 公开）。
 *
 * 策略：本地 SQLite/sql.js 是工作库；这一层把本地行推上 Supabase、把云端行拉回本地，
 * 用每张表都有的 `updated_at` 做「最后写入胜出」，`deleted_at`（软删除）当普通字段一起同步。
 * 各表独立 try/catch：某表出错（比如还没建好）不影响其它表。
 */

type Row = Record<string, unknown>;

const TABLES: { name: string; pk: string }[] = [
  { name: "mini_tables", pk: "id" },
  { name: "mini_table_rows", pk: "id" },
  { name: "study_subjects", pk: "id" },
  { name: "study_sessions", pk: "id" },
  { name: "habits", pk: "id" },
  { name: "habit_checkins", pk: "id" },
  { name: "plan_items", pk: "id" },
  { name: "plan_checks", pk: "id" },
  { name: "plan_notes", pk: "id" },
  { name: "treat_log", pk: "id" },
  { name: "meal_log", pk: "id" },
  { name: "todos", pk: "id" },
  { name: "app_settings", pk: "key" },
];

/** a 是否比 b 新（ISO 字符串直接比较；缺失当最旧） */
function isNewer(a: unknown, b: unknown): boolean {
  return String(a ?? "") > String(b ?? "");
}

async function upsertLocal(
  db: Awaited<ReturnType<typeof getDb>>,
  table: string,
  pk: string,
  row: Row,
): Promise<void> {
  const cols = Object.keys(row);
  if (cols.length === 0) return;
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  const updates = cols
    .filter((c) => c !== pk)
    .map((c) => `${c}=excluded.${c}`)
    .join(", ");
  const sql =
    `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})` +
    (updates ? ` ON CONFLICT(${pk}) DO UPDATE SET ${updates}` : ` ON CONFLICT(${pk}) DO NOTHING`);
  await db.execute(
    sql,
    cols.map((c) => row[c] as unknown),
  );
}

/** 同步一张表；返回本地是否被云端数据改动过 */
async function syncTable(
  db: Awaited<ReturnType<typeof getDb>>,
  name: string,
  pk: string,
): Promise<boolean> {
  const localRows = await db.select<Row[]>(`SELECT * FROM ${name}`);
  const { data: remoteRows, error } = await supabase.from(name).select("*");
  if (error) throw error;

  const localMap = new Map<string, Row>();
  for (const r of localRows) localMap.set(String(r[pk]), r);
  const remoteMap = new Map<string, Row>();
  for (const r of (remoteRows ?? []) as Row[]) remoteMap.set(String(r[pk]), r);

  const toRemote: Row[] = [];
  const toLocal: Row[] = [];

  const keys = new Set<string>([...localMap.keys(), ...remoteMap.keys()]);
  for (const k of keys) {
    const local = localMap.get(k);
    const remote = remoteMap.get(k);
    if (local && !remote) toRemote.push(local);
    else if (!local && remote) toLocal.push(remote);
    else if (local && remote) {
      if (isNewer(local.updated_at, remote.updated_at)) toRemote.push(local);
      else if (isNewer(remote.updated_at, local.updated_at)) toLocal.push(remote);
    }
  }

  if (toRemote.length > 0) {
    const { error: upErr } = await supabase.from(name).upsert(toRemote, { onConflict: pk });
    if (upErr) throw upErr;
  }
  for (const row of toLocal) {
    await upsertLocal(db, name, pk, row);
  }
  return toLocal.length > 0;
}

let syncing = false;

/**
 * 跑一轮全量双向同步。返回本地是否有变化（有则调用方应刷新视图）。
 * 失败（离线等）返回 false，不抛错——保证离线时应用照常用本地数据。
 */
export async function runSync(): Promise<boolean> {
  if (syncing) return false;
  syncing = true;
  try {
    const db = await getDb();
    let changed = false;
    for (const t of TABLES) {
      try {
        const c = await syncTable(db, t.name, t.pk);
        changed = changed || c;
      } catch (e) {
        // 单表失败（表未建 / 偶发冲突）不影响其它表
        const msg = (e as { message?: string })?.message ?? String(e);
        console.warn(`[sync] 表 ${t.name} 同步失败：${msg}`);
      }
    }
    return changed;
  } catch (e) {
    console.warn("[sync] 同步失败（离线？）：", e);
    return false;
  } finally {
    syncing = false;
  }
}
