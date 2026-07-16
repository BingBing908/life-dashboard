import Database from "@tauri-apps/plugin-sql";

const DB_URL = "sqlite:portwritingtool.db";

let dbPromise: Promise<Database> | null = null;

/** 获取全局数据库连接（懒加载单例） */
export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load(DB_URL);
  }
  return dbPromise;
}

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
