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
  /**
   * ⚠️⚠️ **下载失败会连带把上传也堵死**（2026-10-28 查她「标了却没同步上去」时发现）：
   * 这一行一 `throw`，下面那段 upsert **根本跑不到**。下面专门写过一条
   * 「上传失败不能阻断下载」，反过来这条一直没人管——而被堵住的那一侧更要命：
   * 云端的数据丢了还能从别的设备拉回来，**她在这台设备上刚标的东西是独一份**。
   *
   * 所以这里多试两次再放弃。这只能救「网络抖一下」，救不了结构性失败
   * （表没建、缺列、payload 太大必然超时）——那种照旧抛给顶部横幅报警。
   */
  let remoteRows: Row[] = [];
  let pullErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase.from(name).select("*");
    if (!error) {
      remoteRows = (data ?? []) as Row[];
      pullErr = null;
      break;
    }
    pullErr = error;
    if (attempt < 2) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  if (pullErr) throw pullErr;

  const localMap = new Map<string, Row>();
  for (const r of localRows) localMap.set(String(r[pk]), r);
  const remoteMap = new Map<string, Row>();
  for (const r of remoteRows) remoteMap.set(String(r[pk]), r);

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
  if (!syncEnabled()) return false;
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
        markTableSynced(t.name); // 确认过云端这张表长什么样了 ⇒ 这张表允许播种（见文件末尾注释）
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

/* ───────────── 首次同步守卫（2026-10-27 加，为 iPad / 手机上线铺路） ─────────────
 *
 * ⚠️⚠️ 这是为了堵一个会**悄悄弄脏云端真实数据**的坑，别随手删：
 * `App.tsx` 首次进入最多等 4 秒就渲染。手机 4G 第一次打开要下 sql.js 的 WASM + 全量云数据，
 * 4 秒多半不够 ⇒ 本地库还是空的就进了页面 ⇒ `seedIfEmpty()` 按模板播种 39 条，
 * 时间戳是「现在」⇒ 下一轮同步推上云 ⇒ 按「最后写入胜出」，
 * **她早就删掉的旧模板条目会被整批复活**（她的活库和 seed 已经实质分叉，见 CLAUDE.md）。
 *
 * 所以规矩是：**没确认过云端是什么样，就不许播种。**
 * 粒度按**表**记，不是一个全局开关——某张表同步失败（缺列 400）时只锁那张表的播种，
 * 其余照常；而且失败时是「页面空着 + 顶部红字横幅」这种**看得见**的坏，
 * 好过「悄悄把删掉的东西加回来」那种看不见的坏。
 */
const SYNCED_TABLES_KEY = "pwt-synced-tables";

/** 当前环境是否真的会联云（dev 默认不联，见 runSync 开头） */
export function syncEnabled(): boolean {
  return !(import.meta.env.DEV && localStorage.getItem("pwt-sync-on") !== "1");
}

function syncedTables(): Set<string> {
  try {
    const raw = localStorage.getItem(SYNCED_TABLES_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/**
 * 本次会话里真的拉到过云端数据的表。**内存里，刷新即清空**——这是故意的，
 * 见下面 `hasSyncedTable` 的事故注释。
 */
const syncedThisSession = new Set<string>();

function markTableSynced(table: string): void {
  syncedThisSession.add(table);
  const s = syncedTables();
  if (s.has(table)) return;
  s.add(table);
  try {
    localStorage.setItem(SYNCED_TABLES_KEY, JSON.stringify([...s]));
  } catch {
    /* 隐私模式等写不进去：最坏退化成「每次都当首次」，只会多等一会儿，不会写坏数据 */
  }
}

/**
 * 这张表**在本次会话里**成功同步过吗？播种前必须问它。
 *
 * ⚠️⚠️⚠️ **2026-10-28 的真实事故，别把它改回去读 localStorage**：
 * 原来这里读的是持久化的 `pwt-synced-tables`，结果当天 12:56:15，一台新设备把
 * **36 条种子模板整批 upsert 覆盖了她的活数据并推上云**（`seedIfEmpty` 用的是
 * `ON CONFLICT(id) DO UPDATE`，那是 2026-09-18 为修"一键同步全清空"加的），
 * 她 9/20 改过的那些模板行（已知的一条：日日学 `track` 被改回 `frame`）全被打回模板值。
 *
 * **漏洞在于「标记」和「数据」存在两个不同的 localStorage key 里，失败方式不一样**：
 * 数据是 `pwt-sqljs-db`（约 1.5MB，手机上最容易写失败或被回收），标记是个几十字节的小 key。
 * 于是会出现「标记说同步过、库却是空的」⇒ 守卫放行 ⇒ 播种 ⇒ 推上云覆盖。
 * **跨存储的两个事实不可能保证一致，所以这个判断必须只认本次会话真的拉到过云端数据。**
 *
 * 代价：全新设备**离线**首开不会播种，页面是空的 + 顶部同步失败横幅。
 * 这正是这套守卫一开始就定的取舍——**「看得见的空」远好过「看不见的脏」**。
 * ⚠️ 曾经有个 `resetToSeed`（「一键同步」）用 `force` 绕过本守卫——2026-10-29 已整个删除。
 * 它绕过守卫三次、三次都是事故。**别再给这道守卫开后门。**
 */
export function hasSyncedTable(table: string): boolean {
  if (!syncEnabled()) return true;
  return syncedThisSession.has(table);
}

/**
 * 这台设备**历史上**同步过这张表吗（读持久化的那份标记）。
 * ⚠️ **只能用来决定等多久再渲染这类 UX 问题，绝不能用来决定要不要播种**——
 * 它正是 2026-10-28 那次覆盖事故的漏洞所在，原因见 `hasSyncedTable` 的注释。
 */
/**
 * 正在跑同步吗。⚠️ **播种前必须问它**——见 `seedIfEmpty` 里那条竞态注释。
 */
export function isSyncing(): boolean {
  return syncing;
}

export function hasEverSyncedTable(table: string): boolean {
  if (!syncEnabled()) return true;
  return syncedTables().has(table);
}

/**
 * 同步诊断：每张表「本地几行 / 本次会话同步成功没有」。
 *
 * ⚠️ 2026-10-28 加，起因是她在手机上看到「一张表没同步」的横幅，而我连着问了四轮
 * 「是哪张表」都没拿到——**横幅在窄屏上把表名挤没了**。靠用户转述设备状态本来就不可靠，
 * 让 app 自己把状态摊开给她看，才是对的做法。
 */
export async function syncDiagnostics(): Promise<
  { table: string; local: number; syncedNow: boolean; error: string | null }[]
> {
  const db = await getDb();
  const out: { table: string; local: number; syncedNow: boolean; error: string | null }[] = [];
  for (const t of TABLES) {
    let local = -1;
    try {
      const rows = await db.select<{ n: number }[]>(`SELECT COUNT(*) AS n FROM ${t.name}`);
      local = Number(rows[0]?.n ?? -1);
    } catch {
      /* 表还没建（老库）：留 -1，界面显示「—」 */
    }
    out.push({
      table: t.name,
      local,
      syncedNow: syncedThisSession.has(t.name),
      error: syncFailures.get(t.name) ?? null,
    });
  }
  return out;
}

