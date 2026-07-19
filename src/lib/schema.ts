/**
 * 浏览器模式（sql.js）使用的建表 SQL。
 * ⚠️ 必须与 src-tauri/src/lib.rs 中的 migration 保持一致。
 */
export const SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS mini_tables (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        icon        TEXT,
        columns     TEXT NOT NULL DEFAULT '[]',
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        device_id   TEXT,
        deleted_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS mini_table_rows (
        id          TEXT PRIMARY KEY,
        table_id    TEXT NOT NULL REFERENCES mini_tables(id),
        data        TEXT NOT NULL DEFAULT '{}',
        sort_order  REAL NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        device_id   TEXT,
        deleted_at  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_rows_table ON mini_table_rows(table_id);

    CREATE TABLE IF NOT EXISTS study_subjects (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        color       TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        device_id   TEXT,
        deleted_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS study_sessions (
        id          TEXT PRIMARY KEY,
        subject_id  TEXT REFERENCES study_subjects(id),
        minutes     INTEGER NOT NULL DEFAULT 0,
        note        TEXT,
        started_at  TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        device_id   TEXT,
        deleted_at  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_subject ON study_sessions(subject_id);

    CREATE TABLE IF NOT EXISTS habits (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        icon        TEXT,
        color       TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        device_id   TEXT,
        deleted_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS habit_checkins (
        id          TEXT PRIMARY KEY,
        habit_id    TEXT NOT NULL REFERENCES habits(id),
        date        TEXT NOT NULL,
        note        TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        device_id   TEXT,
        deleted_at  TEXT,
        UNIQUE(habit_id, date)
    );
    CREATE INDEX IF NOT EXISTS idx_checkins_habit ON habit_checkins(habit_id);

    CREATE TABLE IF NOT EXISTS app_settings (
        key         TEXT PRIMARY KEY,
        value       TEXT NOT NULL,
        updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plan_items (
        id            TEXT PRIMARY KEY,
        track         TEXT NOT NULL,
        days          TEXT NOT NULL DEFAULT '*',
        time_slot     TEXT,
        title         TEXT NOT NULL,
        detail        TEXT,
        url           TEXT,
        period_action TEXT,
        period_title  TEXT,
        period_detail TEXT,
        sort_order    REAL NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL,
        device_id     TEXT,
        deleted_at    TEXT
    );

    CREATE TABLE IF NOT EXISTS plan_checks (
        id          TEXT PRIMARY KEY,
        item_id     TEXT NOT NULL REFERENCES plan_items(id),
        date        TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        device_id   TEXT,
        deleted_at  TEXT,
        UNIQUE(item_id, date)
    );
    CREATE INDEX IF NOT EXISTS idx_plan_checks_date ON plan_checks(date);

    CREATE TABLE IF NOT EXISTS treat_log (
        id          TEXT PRIMARY KEY,
        kind        TEXT NOT NULL DEFAULT 'milktea',
        date        TEXT NOT NULL,
        note        TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        device_id   TEXT,
        deleted_at  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_treat_log_date ON treat_log(date);

    CREATE TABLE IF NOT EXISTS todos (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        done        INTEGER NOT NULL DEFAULT 0,
        done_at     TEXT,
        quadrant    TEXT NOT NULL DEFAULT 'nn',
        due_date    TEXT,
        sort_order  REAL NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        device_id   TEXT,
        deleted_at  TEXT
    );
`;

/**
 * 浏览器端的增量迁移：对已存在的旧库补列。
 * 逐条执行、忽略"列已存在"错误（SQLite 没有 ADD COLUMN IF NOT EXISTS）。
 */
export const BROWSER_MIGRATIONS = [
  "ALTER TABLE todos ADD COLUMN quadrant TEXT NOT NULL DEFAULT 'nn'",
  "ALTER TABLE todos ADD COLUMN due_date TEXT",
  "DROP TABLE IF EXISTS plan_tasks",
  "ALTER TABLE plan_items ADD COLUMN period_action TEXT",
  "ALTER TABLE plan_items ADD COLUMN period_title TEXT",
  "ALTER TABLE plan_items ADD COLUMN period_detail TEXT",
];
