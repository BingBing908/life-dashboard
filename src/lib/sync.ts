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
  { name: "study_entries", pk: "id" },
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

  /**
   * ⚠️⚠️ **上传失败不能阻断下载**（2026-09-22 发现）：原来这里 `throw upErr` 直接退出，
   * 于是云端 todos 缺 source 列、上传每次 400 的那两天里，**这张表连云端的改动也拉不下来了**
   * ——她本地看到的是一个彻底冻结的表，而我在云端做的修正（比如软删几条脏待办）永远到不了她眼前。
   * 所以：上传的错先记下来，**下载照做**，最后再抛出去让顶部横幅报警。
   */
  let upErrMsg: string | null = null;
  if (toRemote.length > 0) {
    const { error: upErr } = await supabase.from(name).upsert(toRemote, { onConflict: pk });
    if (upErr) upErrMsg = upErr.message;
  }
  for (const row of toLocal) {
    await upsertLocal(db, name, pk, row);
  }
  if (upErrMsg) throw new Error(upErrMsg);
  return toLocal.length > 0;
}



/**
 * 上一轮同步里**上传失败**的表（表名 → 错误消息）。
 *
 * ⚠️⚠️ 2026-09-22 加的，起因是一次静默丢数据：本地迁移到 v15 加了
 * `plan_items.valid_from/valid_to` 和 `todos.source`，但云端那几句 `alter table` 一直没跑，
 * 于是 `upsert` 每次都被 PostgREST 打回 400（"Could not find the 'valid_from' column"）——
 * 而 `runSync` 只 `console.warn`，界面上一点提示都没有。结果她在日程/待办里的改动
 * **两天只存在本机**，自己完全不知道。
 * 所以：同步失败必须**看得见**（App 顶部横幅），别再让它躲在控制台里。
 */
const syncFailures = new Map<string, string>();

export function getSyncFailures(): { table: string; message: string }[] {
  return [...syncFailures].map(([table, message]) => ({ table, message }));
}
let syncing = false;

/**
 * 跑一轮全量双向同步。返回本地是否有变化（有则调用方应刷新视图）。
 * 失败（离线等）返回 false，不抛错——保证离线时应用照常用本地数据。
 */
export async function runSync(): Promise<boolean> {
  // 开发模式默认不与线上云同步（防止本地测试数据污染 Rosie 的生产库）；
  // 要在 dev 里联云，手动 localStorage.setItem('pwt-sync-on','1')。生产永远同步。
  if (import.meta.env.DEV && localStorage.getItem("pwt-sync-on") !== "1") return false;
  if (syncing) return false;
  syncing = true;
  try {
    const db = await getDb();
    let changed = false;
    for (const t of TABLES) {
      try {
        const c = await syncTable(db, t.name, t.pk);
        changed = changed || c;
        syncFailures.delete(t.name); // 这轮好了就把旧警报撤掉
      } catch (e) {
        // 单表失败（表未建 / 缺列 / 偶发冲突）不影响其它表，但**必须留痕**给界面看
        const msg = (e as { message?: string })?.message ?? String(e);
        syncFailures.set(t.name, msg); // 留痕给 App 顶部的横幅用——别再让同步失败只躺在控制台
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
