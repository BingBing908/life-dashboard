import { SCHEMA_SQL } from "./schema";

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
