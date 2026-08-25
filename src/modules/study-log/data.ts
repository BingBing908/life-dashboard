import { getDb, newRecordFields, nowIso } from "@/lib/db";

/** 六大板块 */
export type Board = "review" | "english" | "chinese" | "ai" | "history" | "finance" | "pm" | "book" | "movie";

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
  // 时间戳单调递增：内容常由 Claude 用固定/未来时间戳注入，用户的编辑（如默写记录）
  // 必须严格比它新，否则同步「最后写入胜出」会用注入版盖回、记录丢失。
  const prev = await db.select<{ updated_at: string }[]>(
    "SELECT updated_at FROM study_entries WHERE id = $1",
    [id],
  );
  const now = nowIso();
  const prevTs = prev[0]?.updated_at ?? "";
  const ts = now > prevTs ? now : new Date(Date.parse(prevTs) + 1000).toISOString();
  const sets = cols.map((c, i) => `${c} = $${i + 1}`);
  sets.push(`updated_at = $${cols.length + 1}`);
  const params: unknown[] = [...cols.map((c) => patch[c] ?? null), ts, id];
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

/**
 * 单词「标熟」（2026-08-21 Rosie 要单词表：「双击标熟（但不消失只是颜色变浅一点）」）。
 *
 * ⚠️ **复用 `app_settings`、零改库**——跟体重库（`weight:<date>:am|pm`）和补剂打卡
 * （`supp:<date>:<slot>:<名字>`）完全同一套做法，她不用去 Supabase 跑 SQL，
 * 也自动跟着现有同步走。key ＝ `wordknown:<小写单词>`，值 `"1"`＝已标熟、`""`＝没标。
 *
 * ⚠️ **一个单词一个 key，别把整张表塞成一条 JSON**：同步是"最后写入胜出"，
 * 整片一条的话两台设备各标几个、后同步的那台会把另一台的标记**整片盖掉**。
 * 体重当初就是为这个拆的 am/pm，补剂拆的是单颗药。
 *
 * ⚠️ **取消标熟写 `""` 不是 DELETE**：删了会被别的设备的旧行"复活"（同步没有墓碑）。
 *
 * ⚠️ **按「单词」存，不按「哪篇精读里的那个词」存**：同一个词可能出现在多篇里，
 * 认识了就是认识了，不该在另一篇里又变成生词。这跟单词级 SRS（`meta.wordSrs`）
 * 的调度单位一致——那边也是按词不按篇。
 *
 * ⚠️ 跟 `meta.wordSrs` 是**两件事**，别混：wordSrs 是复习进度（答对了几次、什么时候再考），
 * 这里是她主观说的「这个我会了」。她可以标熟一个还没复习过的词。
 */
const KNOWN_PREFIX = "wordknown:";

/** 已标熟的单词集合（小写） */
export async function getKnownWords(): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.select<{ key: string; value: string }[]>(
    `SELECT key, value FROM app_settings WHERE key LIKE '${KNOWN_PREFIX}%'`,
  );
  const s = new Set<string>();
  for (const r of rows) {
    if (r.value === "1") s.add(r.key.slice(KNOWN_PREFIX.length));
  }
  return s;
}

/** 标熟 / 取消标熟一个单词 */
export async function setWordKnown(en: string, known: boolean): Promise<void> {
  const db = await getDb();
  const key = KNOWN_PREFIX + en.trim().toLowerCase();
  // 单调递增时间戳：防别的设备/注入的未来时间戳把这条盖回（同体重库）
  const prev = await db.select<{ updated_at: string }[]>(
    "SELECT updated_at FROM app_settings WHERE key = $1",
    [key],
  );
  const now = nowIso();
  const prevTs = prev[0]?.updated_at ?? "";
  const ts = now > prevTs ? now : new Date(Date.parse(prevTs) + 1000).toISOString();
  await db.execute(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT(key) DO UPDATE SET value = $2, updated_at = $3`,
    [key, known ? "1" : "", ts],
  );
}
