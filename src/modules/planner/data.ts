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
