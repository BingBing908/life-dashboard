-- life-dashboard 云端表（Supabase / Postgres）
-- 在 Supabase 控制台 → SQL Editor 里整段粘贴运行一次即可（可重复运行，幂等）。
--
-- 设计：镜像本地 SQLite 的列，类型用 text/integer/real；除主键外都可空、且不加外键与次级唯一约束
-- （同步不保证插入顺序、避免批量 upsert 因约束失败）。档位 A：公开可读写（anon 全权限）。
-- ⚠️ 改了本地表结构（lib.rs / schema.ts）时，这里也要同步加列。

create table if not exists public.mini_tables (
  id text primary key, name text, icon text, columns text,
  created_at text, updated_at text, device_id text, deleted_at text
);
create table if not exists public.mini_table_rows (
  id text primary key, table_id text, data text, sort_order real,
  created_at text, updated_at text, device_id text, deleted_at text
);
create table if not exists public.study_subjects (
  id text primary key, name text, color text,
  created_at text, updated_at text, device_id text, deleted_at text
);
create table if not exists public.study_sessions (
  id text primary key, subject_id text, minutes integer, note text, started_at text,
  created_at text, updated_at text, device_id text, deleted_at text
);
create table if not exists public.habits (
  id text primary key, name text, icon text, color text, days text, sort_order real,
  created_at text, updated_at text, device_id text, deleted_at text
);
create table if not exists public.habit_checkins (
  id text primary key, habit_id text, date text, note text,
  created_at text, updated_at text, device_id text, deleted_at text
);
create table if not exists public.plan_items (
  id text primary key, track text, days text, time_slot text, title text, detail text, url text,
  period_action text, period_title text, period_detail text, sort_order real,
  created_at text, updated_at text, device_id text, deleted_at text
);
create table if not exists public.plan_checks (
  id text primary key, item_id text, date text, status text,
  created_at text, updated_at text, device_id text, deleted_at text
);
-- 旧库补列（已建表的项目跑这一行；status: 'done'/'skip'，NULL 视作 done）：
alter table public.plan_checks add column if not exists status text;
create table if not exists public.plan_notes (
  id text primary key, item_id text, date text, note text,
  created_at text, updated_at text, device_id text, deleted_at text
);
create table if not exists public.treat_log (
  id text primary key, kind text, date text, note text, subtype text, brand text, name text,
  sugar text, calories integer,
  created_at text, updated_at text, device_id text, deleted_at text
);
create table if not exists public.meal_log (
  id text primary key, date text, meal text, content text, calories integer,
  created_at text, updated_at text, device_id text, deleted_at text
);
create table if not exists public.todos (
  id text primary key, title text, done integer, done_at text, quadrant text, due_date text,
  sort_order real, created_at text, updated_at text, device_id text, deleted_at text
);
create table if not exists public.app_settings (
  key text primary key, value text, updated_at text
);
create table if not exists public.study_entries (
  id text primary key, board text, kind text, entry_date text, title text, body text,
  meta text, status text, sort_order real,
  created_at text, updated_at text, device_id text, deleted_at text
);

-- 档位 A：开启 RLS，给 anon（publishable key 对应的角色）全权限。
do $$
declare t text;
begin
  foreach t in array array[
    'mini_tables','mini_table_rows','study_subjects','study_sessions','habits',
    'habit_checkins','plan_items','plan_checks','plan_notes','treat_log',
    'meal_log','todos','app_settings','study_entries'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists anon_all on public.%I;', t);
    execute format('create policy anon_all on public.%I for all to anon using (true) with check (true);', t);
    execute format('grant all on public.%I to anon;', t);
  end loop;
end $$;
