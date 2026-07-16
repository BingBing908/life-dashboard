import { getDb, newRecordFields, nowIso } from "@/lib/db";

export type ColumnType = "text" | "number" | "checkbox" | "date" | "select";

export interface MiniColumn {
  id: string;
  name: string;
  type: ColumnType;
  /** select 类型的可选项 */
  options?: string[];
}

export interface MiniTable {
  id: string;
  name: string;
  columns: MiniColumn[];
}

export interface MiniRow {
  id: string;
  table_id: string;
  data: Record<string, unknown>;
  sort_order: number;
}

interface TableRowRaw {
  id: string;
  name: string;
  columns: string;
}

interface RowRaw {
  id: string;
  table_id: string;
  data: string;
  sort_order: number;
}

export async function listTables(): Promise<MiniTable[]> {
  const db = await getDb();
  const rows = await db.select<TableRowRaw[]>(
    "SELECT id, name, columns FROM mini_tables WHERE deleted_at IS NULL ORDER BY created_at",
  );
  return rows.map((r) => ({ ...r, columns: JSON.parse(r.columns) }));
}

export async function createTable(name: string): Promise<MiniTable> {
  const db = await getDb();
  const f = newRecordFields();
  const columns: MiniColumn[] = [
    { id: crypto.randomUUID(), name: "名称", type: "text" },
  ];
  await db.execute(
    "INSERT INTO mini_tables (id, name, columns, created_at, updated_at, device_id) VALUES ($1, $2, $3, $4, $5, $6)",
    [f.id, name, JSON.stringify(columns), f.created_at, f.updated_at, f.device_id],
  );
  return { id: f.id, name, columns };
}

export async function renameTable(id: string, name: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE mini_tables SET name = $1, updated_at = $2 WHERE id = $3",
    [name, nowIso(), id],
  );
}

export async function deleteTable(id: string): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  await db.execute(
    "UPDATE mini_tables SET deleted_at = $1, updated_at = $1 WHERE id = $2",
    [ts, id],
  );
}

export async function updateColumns(
  tableId: string,
  columns: MiniColumn[],
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE mini_tables SET columns = $1, updated_at = $2 WHERE id = $3",
    [JSON.stringify(columns), nowIso(), tableId],
  );
}

export async function listRows(tableId: string): Promise<MiniRow[]> {
  const db = await getDb();
  const rows = await db.select<RowRaw[]>(
    "SELECT id, table_id, data, sort_order FROM mini_table_rows WHERE table_id = $1 AND deleted_at IS NULL ORDER BY sort_order, created_at",
    [tableId],
  );
  return rows.map((r) => ({ ...r, data: JSON.parse(r.data) }));
}

export async function addRow(tableId: string): Promise<MiniRow> {
  const db = await getDb();
  const f = newRecordFields();
  const maxRes = await db.select<{ m: number | null }[]>(
    "SELECT MAX(sort_order) as m FROM mini_table_rows WHERE table_id = $1 AND deleted_at IS NULL",
    [tableId],
  );
  const sortOrder = (maxRes[0]?.m ?? 0) + 1;
  await db.execute(
    "INSERT INTO mini_table_rows (id, table_id, data, sort_order, created_at, updated_at, device_id) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [f.id, tableId, "{}", sortOrder, f.created_at, f.updated_at, f.device_id],
  );
  return { id: f.id, table_id: tableId, data: {}, sort_order: sortOrder };
}

export async function updateRowData(
  rowId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE mini_table_rows SET data = $1, updated_at = $2 WHERE id = $3",
    [JSON.stringify(data), nowIso(), rowId],
  );
}

export async function deleteRow(rowId: string): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  await db.execute(
    "UPDATE mini_table_rows SET deleted_at = $1, updated_at = $1 WHERE id = $2",
    [ts, rowId],
  );
}
