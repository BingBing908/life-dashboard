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
        },
        Migration {
            version: 2,
            description: "create_todos",
            kind: MigrationKind::Up,
            sql: r#"
            -- 待办清单（不挂日期的零散待办）
            CREATE TABLE IF NOT EXISTS todos (
                id          TEXT PRIMARY KEY,
                title       TEXT NOT NULL,
                done        INTEGER NOT NULL DEFAULT 0,
                done_at     TEXT,
                sort_order  REAL NOT NULL DEFAULT 0,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL,
                device_id   TEXT,
                deleted_at  TEXT
            );
        "#,
        },
        Migration {
            version: 3,
            description: "todos_quadrant_due_date",
            kind: MigrationKind::Up,
            sql: r#"
            -- 四象限（iu=重要紧急 in=重要不紧急 nu=紧急不重要 nn=不紧急不重要）
            ALTER TABLE todos ADD COLUMN quadrant TEXT NOT NULL DEFAULT 'nn';
            -- 到期日（YYYY-MM-DD）；等于今天即进入 To Do List
            ALTER TABLE todos ADD COLUMN due_date TEXT;
        "#,
        },
        Migration {
            version: 4,
            description: "drop_planner",
            kind: MigrationKind::Up,
            // 计划表模块已移除（改用 iPad 做下班后规划）
            sql: "DROP TABLE IF EXISTS plan_tasks;",
        },
        Migration {
            version: 5,
            description: "create_study_plan",
            kind: MigrationKind::Up,
            sql: r#"
            -- 学练计划：周计划条目（days: '*'=每天 或 '1,3,5'，1=周一..7=周日）
            CREATE TABLE IF NOT EXISTS plan_items (
                id          TEXT PRIMARY KEY,
                track       TEXT NOT NULL,
                days        TEXT NOT NULL DEFAULT '*',
                time_slot   TEXT,
                title       TEXT NOT NULL,
                detail      TEXT,
                url         TEXT,
                sort_order  REAL NOT NULL DEFAULT 0,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL,
                device_id   TEXT,
                deleted_at  TEXT
            );

            -- 学练计划：每日完成记录
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
        "#,
        },
        Migration {
            version: 6,
            description: "plan_items_period",
            kind: MigrationKind::Up,
            // 经期开关：period_action=''/'skip'/'swap'；swap 时用 period_title/detail 替换
            sql: r#"
            ALTER TABLE plan_items ADD COLUMN period_action TEXT;
            ALTER TABLE plan_items ADD COLUMN period_title TEXT;
            ALTER TABLE plan_items ADD COLUMN period_detail TEXT;
        "#,
        },
        Migration {
            version: 7,
            description: "create_treat_log",
            kind: MigrationKind::Up,
            // 放纵记录（目前用于奶茶打卡，kind 默认 milktea，一杯一条）
            sql: r#"
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
        "#,
        },
    ]
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
