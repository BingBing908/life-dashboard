import { getDb, newRecordFields, nowIso } from "@/lib/db";

export interface Todo {
  id: string;
  title: string;
  done: number;
  done_at: string | null;
  sort_order: number;
  created_at: string;
}

/** 未完成在前（按 sort_order），已完成在后（最近完成的在前） */
export async function listTodos(): Promise<Todo[]> {
  const db = await getDb();
  return db.select<Todo[]>(
    `SELECT id, title, done, done_at, sort_order, created_at
     FROM todos WHERE deleted_at IS NULL
     ORDER BY done, CASE WHEN done = 0 THEN sort_order ELSE 0 END, done_at DESC`,
  );
}

export async function createTodo(title: string, sortOrder: number): Promise<Todo> {
  const db = await getDb();
  const f = newRecordFields();
  await db.execute(
    "INSERT INTO todos (id, title, sort_order, created_at, updated_at, device_id) VALUES ($1, $2, $3, $4, $5, $6)",
    [f.id, title, sortOrder, f.created_at, f.updated_at, f.device_id],
  );
  return {
    id: f.id,
    title,
    done: 0,
    done_at: null,
    sort_order: sortOrder,
    created_at: f.created_at,
  };
}

/** 切换完成状态；返回切换后是否已完成 */
export async function toggleTodo(id: string, done: boolean): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  await db.execute(
    "UPDATE todos SET done = $1, done_at = $2, updated_at = $3 WHERE id = $4",
    [done ? 1 : 0, done ? ts : null, ts, id],
  );
}

export async function updateTodoTitle(id: string, title: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE todos SET title = $1, updated_at = $2 WHERE id = $3",
    [title, nowIso(), id],
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
