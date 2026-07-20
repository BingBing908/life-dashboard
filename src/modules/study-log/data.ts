import { getDb, newRecordFields, nowIso } from "@/lib/db";

/** 六大板块 */
export type Board = "english" | "chinese" | "ai" | "history" | "finance" | "pm" | "book" | "movie";

/** 通用学习条目：一条 = 一篇文章 / 一条新闻 / 一本书 / 一部电影……
 *  内容由 Claude 在对话里生成后，Rosie 贴进 body（meta 存结构化附加信息 JSON） */
export interface Entry {
  id: string;
  board: Board;
  kind: string | null; // 板块内的子类型，如 精读文章/背诵/谚语、新闻/术语卡
  entry_date: string | null; // 归属日期（YYYY-MM-DD）；书籍=开始日
  title: string | null;
  body: string | null;
  meta: string | null; // JSON 字符串（如书籍的 {finish_date}）
  status: string | null; // 书籍：reading/done
  sort_order: number;
  created_at: string;
}

/** 取所有板块的全部条目（一次读、在组件里分组，数据量小时最省事） */
export async function listAllEntries(): Promise<Entry[]> {
  const db = await getDb();
  return db.select<Entry[]>(
    `SELECT id, board, kind, entry_date, title, body, meta, status, sort_order, created_at
       FROM study_entries
      WHERE deleted_at IS NULL
      ORDER BY COALESCE(entry_date, '') DESC, created_at DESC`,
  );
}

export async function listEntries(board: Board): Promise<Entry[]> {
  const db = await getDb();
  return db.select<Entry[]>(
    `SELECT id, board, kind, entry_date, title, body, meta, status, sort_order, created_at
       FROM study_entries
      WHERE board = $1 AND deleted_at IS NULL
      ORDER BY COALESCE(entry_date, '') DESC, created_at DESC`,
    [board],
  );
}

export async function createEntry(e: {
  board: Board;
  kind?: string | null;
  entry_date?: string | null;
  title?: string | null;
  body?: string | null;
  meta?: string | null;
  status?: string | null;
}): Promise<Entry> {
  const db = await getDb();
  const f = newRecordFields();
  const row: Entry = {
    id: f.id,
    board: e.board,
    kind: e.kind ?? null,
    entry_date: e.entry_date ?? null,
    title: e.title ?? null,
    body: e.body ?? null,
    meta: e.meta ?? null,
    status: e.status ?? null,
    sort_order: 0,
    created_at: f.created_at,
  };
  await db.execute(
    `INSERT INTO study_entries
       (id, board, kind, entry_date, title, body, meta, status, sort_order, created_at, updated_at, device_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      row.id, row.board, row.kind, row.entry_date, row.title, row.body,
      row.meta, row.status, row.sort_order, f.created_at, f.updated_at, f.device_id,
    ],
  );
  return row;
}

type EntryPatch = Partial<
  Pick<Entry, "kind" | "entry_date" | "title" | "body" | "meta" | "status">
>;

export async function updateEntry(id: string, patch: EntryPatch): Promise<void> {
  const cols = Object.keys(patch) as (keyof EntryPatch)[];
  if (cols.length === 0) return;
  const db = await getDb();
  const sets = cols.map((c, i) => `${c} = $${i + 1}`);
  sets.push(`updated_at = $${cols.length + 1}`);
  const params: unknown[] = [...cols.map((c) => patch[c] ?? null), nowIso(), id];
  await db.execute(
    `UPDATE study_entries SET ${sets.join(", ")} WHERE id = $${cols.length + 2}`,
    params,
  );
}

export async function deleteEntry(id: string): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  await db.execute(
    "UPDATE study_entries SET deleted_at = $1, updated_at = $1 WHERE id = $2",
    [ts, id],
  );
}

/** 各板块条目数（用于卡片/角标） */
export async function countByBoard(): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db.select<{ board: string; n: number }[]>(
    "SELECT board, COUNT(*) AS n FROM study_entries WHERE deleted_at IS NULL GROUP BY board",
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.board] = Number(r.n);
  return out;
}
