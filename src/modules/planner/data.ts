import { getDb, newRecordFields, nowIso } from "@/lib/db";

export interface PlanTask {
  id: string;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  done: boolean;
  note: string | null;
}

interface PlanTaskRaw extends Omit<PlanTask, "done"> {
  done: number;
}

export async function listTasksByDate(date: string): Promise<PlanTask[]> {
  const db = await getDb();
  const rows = await db.select<PlanTaskRaw[]>(
    "SELECT id, title, date, start_time, end_time, done, note FROM plan_tasks WHERE date = $1 AND deleted_at IS NULL ORDER BY start_time IS NULL, start_time, created_at",
    [date],
  );
  return rows.map((r) => ({ ...r, done: Boolean(r.done) }));
}

/** [start, end] 闭区间内的所有任务（周视图用） */
export async function listTasksBetween(start: string, end: string): Promise<PlanTask[]> {
  const db = await getDb();
  const rows = await db.select<PlanTaskRaw[]>(
    "SELECT id, title, date, start_time, end_time, done, note FROM plan_tasks WHERE date >= $1 AND date <= $2 AND deleted_at IS NULL ORDER BY date, start_time IS NULL, start_time, created_at",
    [start, end],
  );
  return rows.map((r) => ({ ...r, done: Boolean(r.done) }));
}

export async function updateTask(
  id: string,
  patch: { title: string; startTime: string | null; endTime: string | null },
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE plan_tasks SET title = $1, start_time = $2, end_time = $3, updated_at = $4 WHERE id = $5",
    [patch.title, patch.startTime, patch.endTime, nowIso(), id],
  );
}

export async function addTask(
  title: string,
  date: string,
  startTime: string | null,
  endTime: string | null,
): Promise<PlanTask> {
  const db = await getDb();
  const f = newRecordFields();
  await db.execute(
    "INSERT INTO plan_tasks (id, title, date, start_time, end_time, created_at, updated_at, device_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [f.id, title, date, startTime, endTime, f.created_at, f.updated_at, f.device_id],
  );
  return {
    id: f.id,
    title,
    date,
    start_time: startTime,
    end_time: endTime,
    done: false,
    note: null,
  };
}

export async function setTaskDone(id: string, done: boolean): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE plan_tasks SET done = $1, updated_at = $2 WHERE id = $3",
    [done ? 1 : 0, nowIso(), id],
  );
}

export async function deleteTask(id: string): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  await db.execute(
    "UPDATE plan_tasks SET deleted_at = $1, updated_at = $1 WHERE id = $2",
    [ts, id],
  );
}
