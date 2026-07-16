import { getDb, newRecordFields, nowIso } from "@/lib/db";

export interface Subject {
  id: string;
  name: string;
  color: string | null;
}

export interface StudySession {
  id: string;
  subject_id: string | null;
  minutes: number;
  note: string | null;
  started_at: string;
}

const SUBJECT_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
];

export async function listSubjects(): Promise<Subject[]> {
  const db = await getDb();
  return db.select<Subject[]>(
    "SELECT id, name, color FROM study_subjects WHERE deleted_at IS NULL ORDER BY created_at",
  );
}

export async function createSubject(name: string): Promise<Subject> {
  const db = await getDb();
  const f = newRecordFields();
  const existing = await listSubjects();
  const color = SUBJECT_COLORS[existing.length % SUBJECT_COLORS.length];
  await db.execute(
    "INSERT INTO study_subjects (id, name, color, created_at, updated_at, device_id) VALUES ($1, $2, $3, $4, $5, $6)",
    [f.id, name, color, f.created_at, f.updated_at, f.device_id],
  );
  return { id: f.id, name, color };
}

export async function deleteSubject(id: string): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  await db.execute(
    "UPDATE study_subjects SET deleted_at = $1, updated_at = $1 WHERE id = $2",
    [ts, id],
  );
}

/** 最近的学习记录（新到旧） */
export async function listRecentSessions(limit = 50): Promise<StudySession[]> {
  const db = await getDb();
  return db.select<StudySession[]>(
    "SELECT id, subject_id, minutes, note, started_at FROM study_sessions WHERE deleted_at IS NULL ORDER BY started_at DESC LIMIT $1",
    [limit],
  );
}

export async function addSession(
  subjectId: string | null,
  minutes: number,
  note: string | null,
): Promise<StudySession> {
  const db = await getDb();
  const f = newRecordFields();
  const startedAt = nowIso();
  await db.execute(
    "INSERT INTO study_sessions (id, subject_id, minutes, note, started_at, created_at, updated_at, device_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [f.id, subjectId, minutes, note, startedAt, f.created_at, f.updated_at, f.device_id],
  );
  return { id: f.id, subject_id: subjectId, minutes, note, started_at: startedAt };
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  await db.execute(
    "UPDATE study_sessions SET deleted_at = $1, updated_at = $1 WHERE id = $2",
    [ts, id],
  );
}

/** 某天（本地时区）的总学习分钟数 */
export function minutesOnDate(sessions: StudySession[], dateStr: string): number {
  return sessions
    .filter((s) => {
      const d = new Date(s.started_at);
      const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return local === dateStr;
    })
    .reduce((sum, s) => sum + s.minutes, 0);
}
