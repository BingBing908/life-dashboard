import { getDb, newRecordFields, nowIso } from "@/lib/db";
import { todayStr } from "@/lib/dates";

export interface TreatStats {
  todayCount: number;
  monthCount: number;
  lastDate: string | null;
}

/** 记一杯（默认奶茶、默认今天） */
export async function logTreat(kind = "milktea", date = todayStr()): Promise<void> {
  const db = await getDb();
  const f = newRecordFields();
  await db.execute(
    "INSERT INTO treat_log (id, kind, date, created_at, updated_at, device_id) VALUES ($1, $2, $3, $4, $5, $6)",
    [f.id, kind, date, f.created_at, f.updated_at, f.device_id],
  );
}

/** 撤销今天最近记的一杯 */
export async function undoTreatToday(kind = "milktea", date = todayStr()): Promise<void> {
  const db = await getDb();
  const rows = await db.select<{ id: string }[]>(
    "SELECT id FROM treat_log WHERE kind = $1 AND date = $2 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1",
    [kind, date],
  );
  if (rows[0]) {
    const ts = nowIso();
    await db.execute("UPDATE treat_log SET deleted_at = $1, updated_at = $1 WHERE id = $2", [
      ts,
      rows[0].id,
    ]);
  }
}

export async function treatStats(kind = "milktea"): Promise<TreatStats> {
  const db = await getDb();
  const today = todayStr();
  const monthStart = today.slice(0, 8) + "01";
  const rows = await db.select<{ date: string }[]>(
    "SELECT date FROM treat_log WHERE kind = $1 AND deleted_at IS NULL ORDER BY date DESC",
    [kind],
  );
  return {
    todayCount: rows.filter((r) => r.date === today).length,
    monthCount: rows.filter((r) => r.date >= monthStart).length,
    lastDate: rows[0]?.date ?? null,
  };
}
