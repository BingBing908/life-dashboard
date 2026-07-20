import { BROWSER_MIGRATIONS, SCHEMA_SQL } from "./schema";

/**
 * 数据层的最小接口。桌面端由 tauri-plugin-sql 实现（本地 SQLite 文件），
 * 纯浏览器环境由 sql.js (WASM SQLite) 实现（存 localStorage），
 * 这样在 Codespaces / Claude Code 网页版里也能预览完整功能。
 */
export interface DbClient {
  select<T>(sql: string, params?: unknown[]): Promise<T>;
  execute(sql: string, params?: unknown[]): Promise<unknown>;
}

const DB_URL = "sqlite:portwritingtool.db";

function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

let dbPromise: Promise<DbClient> | null = null;

/** 获取全局数据库连接（懒加载单例，自动选择运行环境） */
export function getDb(): Promise<DbClient> {
  if (!dbPromise) {
    dbPromise = isTauri() ? loadTauriDb() : loadBrowserDb();
  }
  return dbPromise;
}

async function loadTauriDb(): Promise<DbClient> {
  const { default: Database } = await import("@tauri-apps/plugin-sql");
  return Database.load(DB_URL);
}

// ---------- 浏览器模式：sql.js + localStorage 持久化 ----------

const STORAGE_KEY = "pwt-sqljs-db";

async function loadBrowserDb(): Promise<DbClient> {
  const initSqlJs = (await import("sql.js")).default;
  const wasmUrl = (await import("sql.js/dist/sql-wasm.wasm?url")).default;
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });

  const saved = localStorage.getItem(STORAGE_KEY);
  const db = saved ? new SQL.Database(fromBase64(saved)) : new SQL.Database();
  db.exec(SCHEMA_SQL);
  for (const sql of BROWSER_MIGRATIONS) {
    try {
      db.run(sql);
    } catch {
      // 列已存在（duplicate column）——旧库已迁移过，忽略
    }
  }

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  function schedulePersist() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, toBase64(db.export()));
    }, 300);
  }

  // 我们的 SQL 都用 $1..$n 顺序占位符，转成 SQLite 的编号占位符 ?N
  // （不能转成裸 ?：同一个 $1 在语句里可能出现多次，?N 才能正确复用参数）
  const toQmark = (sql: string) => sql.replace(/\$(\d+)/g, "?$1");

  return {
    async select<T>(sql: string, params: unknown[] = []): Promise<T> {
      const stmt = db.prepare(toQmark(sql));
      try {
        stmt.bind(params as (string | number | null)[]);
        const rows: Record<string, unknown>[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        return rows as T;
      } finally {
        stmt.free();
      }
    },
    async execute(sql: string, params: unknown[] = []): Promise<unknown> {
      db.run(toQmark(sql), params as (string | number | null)[]);
      schedulePersist();
      return undefined;
    },
  };
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ---------- 公共辅助 ----------

export function uuid(): string {
  return crypto.randomUUID();
}

/**
 * 确定性 id：同一 key 在任意设备都生成同一个 UUID 格式字符串。
 * 专给**预置种子**用——两台设备播种同一模板会得到相同 id，云同步时 upsert
 * 相互覆盖而非翻倍（修 #25 种子重复）。用户手动录入的数据仍用随机 `uuid()`。
 * 非加密哈希（4 轮 FNV-1a 拼 128 位），只需在小规模种子集内稳定不撞即可。
 */
export function seedUuid(key: string): string {
  const bytes = new Uint8Array(16);
  for (let r = 0; r < 4; r++) {
    const s = `${r}:${key}`;
    let h = 0x811c9dc5; // FNV offset basis
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193); // FNV prime
    }
    h >>>= 0;
    bytes[r * 4] = (h >>> 24) & 0xff;
    bytes[r * 4 + 1] = (h >>> 16) & 0xff;
    bytes[r * 4 + 2] = (h >>> 8) & 0xff;
    bytes[r * 4 + 3] = h & 0xff;
  }
  // 置 version(5) / variant 位，确保是合法 UUID 格式
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** 本机设备标识，为未来多设备同步预留 */
export function getDeviceId(): string {
  let id = localStorage.getItem("device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("device_id", id);
  }
  return id;
}

/** 新记录的公共字段（id + 时间戳 + 设备标识） */
export function newRecordFields() {
  const ts = nowIso();
  return {
    id: uuid(),
    created_at: ts,
    updated_at: ts,
    device_id: getDeviceId(),
  };
}
