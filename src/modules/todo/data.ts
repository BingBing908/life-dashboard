import { getDb, newRecordFields, nowIso } from "@/lib/db";

/** 四象限：iu=重要紧急 in=重要不紧急 nu=紧急不重要 nn=不紧急不重要 */
export type Quadrant = "iu" | "in" | "nu" | "nn";

export const QUADRANTS: { key: Quadrant; name: string }[] = [
  { key: "iu", name: "重要紧急" },
  { key: "in", name: "重要不紧急" },
  { key: "nu", name: "紧急不重要" },
  { key: "nn", name: "不紧急不重要" },
];

export interface Todo {
  id: string;
  title: string;
  done: number;
  done_at: string | null;
  quadrant: Quadrant;
  due_date: string | null;
  sort_order: number;
  created_at: string;
}

/** 未完成在前（按 sort_order），已完成在后（最近完成的在前） */
export async function listTodos(): Promise<Todo[]> {
  const db = await getDb();
  return db.select<Todo[]>(
    `SELECT id, title, done, done_at, quadrant, due_date, sort_order, created_at
     FROM todos WHERE deleted_at IS NULL
     ORDER BY done, CASE WHEN done = 0 THEN sort_order ELSE 0 END, done_at DESC`,
  );
}

export async function createTodo(
  title: string,
  quadrant: Quadrant,
  dueDate: string | null,
  sortOrder: number,
): Promise<Todo> {
  const db = await getDb();
  const f = newRecordFields();
  await db.execute(
    `INSERT INTO todos (id, title, quadrant, due_date, sort_order, created_at, updated_at, device_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [f.id, title, quadrant, dueDate, sortOrder, f.created_at, f.updated_at, f.device_id],
  );
  return {
    id: f.id,
    title,
    done: 0,
    done_at: null,
    quadrant,
    due_date: dueDate,
    sort_order: sortOrder,
    created_at: f.created_at,
  };
}

export async function toggleTodo(id: string, done: boolean): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  await db.execute(
    "UPDATE todos SET done = $1, done_at = $2, updated_at = $3 WHERE id = $4",
    [done ? 1 : 0, done ? ts : null, ts, id],
  );
}

/** 设置/清除到期日（送进今天 = 设为今天的日期；移回待办 = null） */
export async function setTodoDueDate(id: string, dueDate: string | null): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE todos SET due_date = $1, updated_at = $2 WHERE id = $3",
    [dueDate, nowIso(), id],
  );
}

export async function updateTodoTitle(id: string, title: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE todos SET title = $1, updated_at = $2 WHERE id = $3",
    [title, nowIso(), id],
  );
}

export async function setTodoQuadrant(id: string, quadrant: Quadrant): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE todos SET quadrant = $1, updated_at = $2 WHERE id = $3",
    [quadrant, nowIso(), id],
  );
}

export async function deleteTodo(id: string): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  await db.execute(
    "UPDATE todos SET deleted_at = $1, updated_at = $1 WHERE id = $2",
    [ts, id],
  );
}

/** 清除所有已完成（软删除） */
export async function clearDone(): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  await db.execute(
    "UPDATE todos SET deleted_at = $1, updated_at = $1 WHERE done = 1 AND deleted_at IS NULL",
    [ts],
  );
}

/** 统计某个日期区间内完成的待办数（done_at 落在区间内，含已软删除的） */
export async function countDoneBetween(startIso: string, endIso: string): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ n: number }[]>(
    "SELECT COUNT(*) AS n FROM todos WHERE done = 1 AND done_at >= $1 AND done_at < $2",
    [startIso, endIso],
  );
  return rows[0]?.n ?? 0;
}
