import { getDb, newRecordFields, nowIso } from "@/lib/db";
import { toDateStr, todayStr } from "@/lib/dates";

/**
 * 备忘录（2026-11-09 加，Rosie：「我现在想把一批修改建议放进去，
 * 但是放在待办一条一条加很麻烦」）。
 *
 * ⚠️ **刻意没有 title 列**——标题取正文第一行，跟 iPad 备忘录一样。
 * 她要的就是「打开就能往里倒一大段」，多一个必填的标题框就等于多一道摩擦，
 * 正是待办那种「一条一条加」的毛病。想改标题＝改第一行。
 */
export interface Note {
  id: string;
  body: string;
  /** 1＝置顶（长期在用的那条不会被新建的挤下去） */
  pinned: number;
  created_at: string;
  updated_at: string;
}

/** 置顶在前，其余按最近修改倒序（iPad 备忘录的排法） */
export async function listNotes(): Promise<Note[]> {
  const db = await getDb();
  return db.select<Note[]>(
    `SELECT id, body, pinned, created_at, updated_at
     FROM notes WHERE deleted_at IS NULL
     ORDER BY pinned DESC, updated_at DESC`,
  );
}

export async function createNote(body = ""): Promise<Note> {
  const db = await getDb();
  const f = newRecordFields();
  await db.execute(
    `INSERT INTO notes (id, body, pinned, created_at, updated_at, device_id)
     VALUES ($1, $2, 0, $3, $4, $5)`,
    [f.id, body, f.created_at, f.updated_at, f.device_id],
  );
  return { id: f.id, body, pinned: 0, created_at: f.created_at, updated_at: f.updated_at };
}

/**
 * 存正文，返回实际写进去的 updated_at。
 *
 * ⚠️ **时间戳单调递增**（同体重库 / study_entries）：同步是「最后写入胜出」，
 * 一旦这行的旧 updated_at 因为别的设备或手滑变成未来时间，之后的编辑就会被它盖回去。
 * 严格比旧值新，她打的字才留得住。
 */
export async function updateNoteBody(id: string, body: string): Promise<string> {
  const db = await getDb();
  const prev = await db.select<{ updated_at: string }[]>(
    "SELECT updated_at FROM notes WHERE id = $1",
    [id],
  );
  const now = nowIso();
  const prevTs = prev[0]?.updated_at ?? "";
  const ts = now > prevTs ? now : new Date(Date.parse(prevTs) + 1000).toISOString();
  await db.execute("UPDATE notes SET body = $1, updated_at = $2 WHERE id = $3", [body, ts, id]);
  return ts;
}

export async function setNotePinned(id: string, pinned: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE notes SET pinned = $1, updated_at = $2 WHERE id = $3", [
    pinned ? 1 : 0,
    nowIso(),
    id,
  ]);
}

/** 软删除（同全站约定，查询一律过滤 deleted_at IS NULL） */
export async function deleteNote(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE notes SET deleted_at = $1, updated_at = $1 WHERE id = $2", [
    nowIso(),
    id,
  ]);
}

/** 标题＝第一行非空文本（iPad 备忘录的做法）。空备忘录给个占位名，列表里才不是一片空白 */
export function noteTitle(body: string): string {
  const first = body.split("\n").map((s) => s.trim()).find(Boolean) ?? "";
  return first.slice(0, 40) || "新备忘录";
}

/** 预览＝第一行之后的内容压成一行（标题已经显示过第一行了，别重复） */
export function notePreview(body: string): string {
  const rest = body.split("\n").map((s) => s.trim()).filter(Boolean).slice(1);
  return rest.join("  ").slice(0, 120);
}

/** 今天只给时分、今年给月日、更早给全日期（同 iPad 备忘录） */
export function noteWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = toDateStr(d);
  const today = todayStr();
  if (date === today) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  if (date.slice(0, 4) === today.slice(0, 4)) return `${d.getMonth() + 1}月${d.getDate()}日`;
  return date;
}
