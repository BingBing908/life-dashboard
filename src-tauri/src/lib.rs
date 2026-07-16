use tauri_plugin_sql::{Migration, MigrationKind};

fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "create_core_tables",
        kind: MigrationKind::Up,
        sql: r#"
            -- 通用小表格：表定义（列结构存 JSON）
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

            -- 通用小表格：行数据（单元格值存 JSON）
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

            -- 计划表：任务/时间块
            CREATE TABLE IF NOT EXISTS plan_tasks (
                id          TEXT PRIMARY KEY,
                title       TEXT NOT NULL,
                date        TEXT NOT NULL,
                start_time  TEXT,
                end_time    TEXT,
                done        INTEGER NOT NULL DEFAULT 0,
                repeat_rule TEXT,
                note        TEXT,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL,
                device_id   TEXT,
                deleted_at  TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_plan_tasks_date ON plan_tasks(date);

            -- 学习记录：科目
            CREATE TABLE IF NOT EXISTS study_subjects (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                color       TEXT,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL,
                device_id   TEXT,
                deleted_at  TEXT
            );

            -- 学习记录：学习时段
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

            -- 打卡：习惯定义
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

            -- 打卡：打卡记录（每习惯每天一条）
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

            -- 应用设置 / 仪表盘布局（key-value）
            CREATE TABLE IF NOT EXISTS app_settings (
                key         TEXT PRIMARY KEY,
                value       TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            );
        "#,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:portwritingtool.db", migrations())
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
