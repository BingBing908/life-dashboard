import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Film,
  Landmark,
  Library,
  LineChart,
  PenLine,
  Plus,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { todayStr } from "@/lib/dates";
import type { AppModule } from "../types";
import {
  createEntry,
  deleteEntry,
  listAllEntries,
  updateEntry,
  type Board,
  type Entry,
} from "./data";

type Palette = { bg: string; text: string; sub: string; accent: string };
type BoardCfg = {
  key: Board;
  name: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  kinds?: string[];
  hint: string;
  c: Palette;
};

const BOARDS: BoardCfg[] = [
  { key: "english", name: "英语", icon: BookOpen, kinds: ["精读文章", "背诵", "谚语"], hint: "每日精读 + 背诵 + 谚语", c: { bg: "#E6F1FB", text: "#0C447C", sub: "#185FA5", accent: "#378ADD" } },
  { key: "chinese", name: "语文", icon: PenLine, kinds: ["成语", "古诗", "练笔"], hint: "成语配典故 · 古诗 · 练笔", c: { bg: "#FAECE7", text: "#712B13", sub: "#993C1D", accent: "#D85A30" } },
  { key: "ai", name: "AI", icon: Sparkles, kinds: ["新闻", "术语卡"], hint: "每日 5 条新闻 + 术语卡", c: { bg: "#EEEDFE", text: "#3C3489", sub: "#534AB7", accent: "#7F77DD" } },
  { key: "history", name: "历史", icon: Landmark, kinds: ["时间线", "事件/人物"], hint: "时间线框架 + 每日一卡", c: { bg: "#FAEEDA", text: "#633806", sub: "#854F0B", accent: "#BA7517" } },
  { key: "finance", name: "金融", icon: LineChart, kinds: ["K线基础", "基金知识", "基金新闻", "我的复盘"], hint: "看懂日线 · 基金入门（教知识、不荐买卖）", c: { bg: "#EAF3DE", text: "#27500A", sub: "#3B6D11", accent: "#639922" } },
  { key: "book", name: "书籍", icon: Library, hint: "在读/读过的书 + 读后感", c: { bg: "#E1F5EE", text: "#085041", sub: "#0F6E56", accent: "#1D9E75" } },
  { key: "movie", name: "电影", icon: Film, hint: "看过的电影 + 观后感", c: { bg: "#FBEAF0", text: "#72243E", sub: "#993556", accent: "#D4537E" } },
];

function metaGet(e: Entry, key: string): string {
  try {
    return e.meta ? (JSON.parse(e.meta)[key] ?? "") : "";
  } catch {
    return "";
  }
}
function withMeta(e: Entry, patch: Record<string, unknown>): string {
  let m: Record<string, unknown> = {};
  try {
    m = e.meta ? JSON.parse(e.meta) : {};
  } catch {
    m = {};
  }
  return JSON.stringify({ ...m, ...patch });
}

// ---------- 顶层组件（含输入的都在顶层，避免重渲染失焦）----------

/** 主界面：六个彩色方框，右侧露出内容预览 */
function Landing({
  entries,
  onOpen,
}: {
  entries: Entry[];
  onOpen: (b: Board) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {BOARDS.map((b) => {
        const mine = entries.filter((e) => e.board === b.key);
        const covers = mine
          .filter((e) => e.kind !== "note" && metaGet(e, "cover"))
          .slice(0, 3);
        const latest = mine.find((e) => e.kind !== "note");
        return (
          <button
            key={b.key}
            onClick={() => onOpen(b.key)}
            className="flex min-h-36 gap-5 rounded-2xl p-6 text-left transition-transform hover:scale-[1.01]"
            style={{ background: b.c.bg }}
          >
            <div className="w-24 shrink-0">
              <b.icon className="size-9" style={{ color: b.c.accent }} />
              <div className="mt-3 text-2xl font-medium" style={{ color: b.c.text }}>
                {b.name}
              </div>
              <div className="mt-0.5 text-sm" style={{ color: b.c.sub }}>
                {mine.filter((e) => e.kind !== "note").length} 条
              </div>
            </div>
            <div className="min-w-0 flex-1 border-l pl-5" style={{ borderColor: b.c.accent + "55" }}>
              {b.key === "book" || b.key === "movie" ? (
                covers.length > 0 ? (
                  <div className="flex gap-2">
                    {covers.map((e) => (
                      <div key={e.id} className="h-24 w-16 shrink-0 overflow-hidden rounded-md" style={{ background: b.c.accent + "33" }}>
                        {metaGet(e, "cover") && (
                          <img src={metaGet(e, "cover")} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: b.c.sub }}>{b.hint}</p>
                )
              ) : latest ? (
                <>
                  <p className="text-sm font-medium" style={{ color: b.c.text }}>
                    {latest.kind}
                    {latest.title ? ` · ${latest.title}` : ""}
                  </p>
                  <p className="mt-1.5 line-clamp-4 text-sm leading-relaxed" style={{ color: b.c.sub }}>
                    {latest.body || b.hint}
                  </p>
                </>
              ) : (
                <p className="text-sm" style={{ color: b.c.sub }}>{b.hint}</p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** 通用板块（英语/语文/AI/历史）：当天展开，历史按日期折叠 */
function LearningBoard({
  cfg,
  entries,
  onAdd,
  onDelete,
}: {
  cfg: BoardCfg;
  entries: Entry[];
  onAdd: (kind: string, title: string, body: string) => void;
  onDelete: (id: string) => void;
}) {
  const today = todayStr();
  const [open, setOpen] = useState<Record<string, boolean>>({ [today]: true });
  const [adding, setAdding] = useState(false);

  const byDate = new Map<string, Entry[]>();
  for (const e of entries) {
    const d = e.entry_date || "未标日期";
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(e);
  }
  const dates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : -1));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          平时内容我帮你更新；也可以自己加一条
        </p>
        <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
          <Plus className="size-4" /> 加一条
        </Button>
      </div>

      {adding && <AddEntryForm kinds={cfg.kinds!} onAdd={(k, t, b) => { onAdd(k, t, b); setAdding(false); }} />}

      {dates.length === 0 && !adding && (
        <p className="py-10 text-sm text-muted-foreground">
          还没有内容。晚上发我「{cfg.name}学完了，换新的」，我更新进来；你打开就能看到。
        </p>
      )}

      <div className="space-y-3">
        {dates.map((d) => {
          const isToday = d === today;
          const isOpen = open[d] ?? isToday;
          const items = byDate.get(d)!;
          return (
            <section key={d} className="rounded-xl border bg-card">
              <button
                onClick={() => setOpen((o) => ({ ...o, [d]: !isOpen }))}
                className="flex w-full items-center gap-2 px-4 py-3 text-left"
              >
                {isOpen ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                <span className="text-sm font-medium" style={{ color: isToday ? cfg.c.sub : undefined }}>
                  {isToday ? "今天" : d}
                </span>
                <span className="text-xs text-muted-foreground">
                  {items.map((i) => i.kind).filter(Boolean).join(" · ")}
                </span>
                {isToday && (
                  <span className="ml-auto rounded-full px-2 py-0.5 text-xs" style={{ background: cfg.c.bg, color: cfg.c.text }}>
                    今日
                  </span>
                )}
              </button>
              {isOpen && (
                <div className="space-y-2 px-4 pb-4">
                  {items.map((e) => (
                    <EntryDoc key={e.id} entry={e} accent={cfg.c.accent} onDelete={onDelete} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** 一条学习内容（展示为主，可删） */
function EntryDoc({ entry, accent, onDelete }: { entry: Entry; accent: string; onDelete: (id: string) => void }) {
  return (
    <div className="group rounded-lg border bg-background p-3">
      <div className="flex items-center gap-2">
        {entry.kind && (
          <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: accent + "22", color: accent }}>
            {entry.kind}
          </span>
        )}
        {entry.title && <span className="text-sm font-medium">{entry.title}</span>}
        <button
          className="invisible ml-auto text-muted-foreground hover:text-destructive group-hover:visible"
          title="删除"
          onClick={() => onDelete(entry.id)}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      {entry.body && (
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{entry.body}</p>
      )}
    </div>
  );
}

function AddEntryForm({ kinds, onAdd }: { kinds: string[]; onAdd: (k: string, t: string, b: string) => void }) {
  const [kind, setKind] = useState(kinds[0]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  return (
    <div className="mb-4 rounded-xl border bg-muted/30 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-md border">
          {kinds.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={cn("px-3 py-1 text-sm", kind === k ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
            >
              {k}
            </button>
          ))}
        </div>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题（可选）" className="min-w-40 flex-1" />
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="内容"
        className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40"
      />
      <div className="mt-2 flex justify-end">
        <Button size="sm" onClick={() => { if (title.trim() || body.trim()) { onAdd(kind, title.trim(), body.trim()); setTitle(""); setBody(""); } }}>
          <Plus className="size-4" /> 添加
        </Button>
      </div>
    </div>
  );
}

/** 5 星评分 */
function Stars({ value, onChange, accent }: { value: number; onChange: (v: number) => void; accent: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} onClick={() => onChange(n === value ? 0 : n)} title={`${n} 星`}>
          <Star className="size-5" style={{ color: accent, fill: n <= value ? accent : "transparent" }} />
        </button>
      ))}
    </div>
  );
}

function AddTitleForm({ placeholder, cta, onAdd }: { placeholder: string; cta: string; onAdd: (t: string) => void }) {
  const [t, setT] = useState("");
  return (
    <div className="mb-5 flex max-w-md gap-2">
      <Input value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => e.key === "Enter" && t.trim() && (onAdd(t.trim()), setT(""))} placeholder={placeholder} />
      <Button onClick={() => t.trim() && (onAdd(t.trim()), setT(""))}>
        <Plus className="size-4" /> {cta}
      </Button>
    </div>
  );
}

/** 书籍板块：书架 + 点进本子 */
function BookBoard({
  cfg,
  books,
  notesByBook,
  openId,
  onOpenBook,
  onAdd,
  onPatch,
  onDelete,
  onAddNote,
  onDeleteNote,
}: {
  cfg: BoardCfg;
  books: Entry[];
  notesByBook: Map<string, Entry[]>;
  openId: string | null;
  onOpenBook: (id: string | null) => void;
  onAdd: (t: string) => void;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onAddNote: (bookId: string, body: string) => void;
  onDeleteNote: (id: string) => void;
}) {
  const book = openId ? books.find((b) => b.id === openId) : null;
  if (book) {
    return (
      <BookNotebook
        cfg={cfg}
        book={book}
        notes={notesByBook.get(book.id) ?? []}
        onBack={() => onOpenBook(null)}
        onPatch={onPatch}
        onDelete={(id) => { onDelete(id); onOpenBook(null); }}
        onAddNote={onAddNote}
        onDeleteNote={onDeleteNote}
      />
    );
  }
  return (
    <div>
      <AddTitleForm placeholder="书名（开始读就加进来，我给它找封面）" cta="开始读" onAdd={onAdd} />
      {books.length === 0 ? (
        <p className="py-10 text-sm text-muted-foreground">还没有书。上面加一本开始，我帮你找封面。</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {books.map((b) => {
            const cover = metaGet(b, "cover");
            const rating = Number(metaGet(b, "rating") || 0);
            const done = b.status === "done";
            return (
              <button key={b.id} onClick={() => onOpenBook(b.id)} className="overflow-hidden rounded-xl border bg-card text-left">
                <div className="flex aspect-[3/4] items-center justify-center" style={{ background: cfg.c.bg }}>
                  {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <Library className="size-8" style={{ color: cfg.c.accent }} />}
                </div>
                <div className="p-2">
                  <p className="truncate text-sm font-medium">{b.title}</p>
                  <p className="text-xs" style={{ color: cfg.c.sub }}>
                    {done ? `读完 · ${"★".repeat(rating)}` : "在读"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** 一本书的本子：封面 + 状态 + 评分 + 每日进度/随笔 + 读后感 */
function BookNotebook({
  cfg,
  book,
  notes,
  onBack,
  onPatch,
  onDelete,
  onAddNote,
  onDeleteNote,
}: {
  cfg: BoardCfg;
  book: Entry;
  notes: Entry[];
  onBack: () => void;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onAddNote: (bookId: string, body: string) => void;
  onDeleteNote: (id: string) => void;
}) {
  const [note, setNote] = useState("");
  const cover = metaGet(book, "cover");
  const rating = Number(metaGet(book, "rating") || 0);
  const done = book.status === "done";
  return (
    <div>
      <button onClick={onBack} className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> 书架
      </button>
      <div className="flex gap-4">
        <div className="h-40 w-28 shrink-0 overflow-hidden rounded-lg" style={{ background: cfg.c.bg }}>
          {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : (
            <div className="flex h-full items-center justify-center"><Library className="size-8" style={{ color: cfg.c.accent }} /></div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{book.title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            开始 {book.entry_date ?? "—"}
            {done && metaGet(book, "finish_date") && ` · 读完 ${metaGet(book, "finish_date")}`}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => onPatch(book.id, done ? { status: "reading", finish_date: "" } : { status: "done", finish_date: todayStr() })}
              className="rounded-md border px-2.5 py-1 text-xs text-primary hover:bg-accent"
            >
              {done ? "在读" : "标记读完"}
            </button>
            {done && <Stars value={rating} onChange={(v) => onPatch(book.id, { rating: v })} accent={cfg.c.accent} />}
          </div>
          {cover ? null : (
            <p className="mt-2 text-xs text-muted-foreground">封面待补：告诉我书名，我联网找了填进来。</p>
          )}
        </div>
      </div>

      {/* 每日进度 / 随笔 */}
      <div className="mt-5">
        <p className="mb-2 text-sm font-medium">阅读进度 · 随笔</p>
        <div className="mb-2 flex gap-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && note.trim() && (onAddNote(book.id, note.trim()), setNote(""))} placeholder="今天看到哪了 / 随手写点想法" />
          <Button onClick={() => note.trim() && (onAddNote(book.id, note.trim()), setNote(""))}>
            <Plus className="size-4" /> 记一笔
          </Button>
        </div>
        <div className="space-y-1.5">
          {notes.map((n) => (
            <div key={n.id} className="group flex items-start gap-2 rounded-lg border bg-background px-3 py-2">
              <span className="shrink-0 text-xs text-muted-foreground">{n.entry_date}</span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap text-sm">{n.body}</span>
              <button className="invisible text-muted-foreground hover:text-destructive group-hover:visible" onClick={() => onDeleteNote(n.id)}>
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 读后感 */}
      <div className="mt-5">
        <p className="mb-2 text-sm font-medium">读后感{done ? "（读完必写）" : ""}</p>
        <textarea
          defaultValue={book.body ?? ""}
          onBlur={(e) => onPatch(book.id, { __body: e.target.value })}
          placeholder="读完写一篇；读的过程中也能随时写"
          className="min-h-28 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-1 focus:ring-primary/40"
        />
      </div>

      <div className="mt-4">
        <button onClick={() => onDelete(book.id)} className="text-xs text-muted-foreground hover:text-destructive">删除这本书</button>
      </div>
    </div>
  );
}

/** 电影板块：海报墙 */
function MovieBoard({
  cfg,
  movies,
  onAdd,
  onPatch,
  onDelete,
}: {
  cfg: BoardCfg;
  movies: Entry[];
  onAdd: (t: string) => void;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <AddTitleForm placeholder="片名（看完记一部，我给它找海报）" cta="记一部" onAdd={onAdd} />
      {movies.length === 0 ? (
        <p className="py-10 text-sm text-muted-foreground">还没有电影。看完一部就记进来。</p>
      ) : (
        <div className="space-y-3">
          {movies.map((m) => (
            <MovieCard key={m.id} cfg={cfg} movie={m} onPatch={onPatch} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function MovieCard({ cfg, movie, onPatch, onDelete }: { cfg: BoardCfg; movie: Entry; onPatch: (id: string, patch: Record<string, unknown>) => void; onDelete: (id: string) => void }) {
  const cover = metaGet(movie, "cover");
  const rating = Number(metaGet(movie, "rating") || 0);
  return (
    <div className="group flex gap-3 rounded-xl border bg-card p-3">
      <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg" style={{ background: cfg.c.bg }}>
        {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : (
          <div className="flex h-full items-center justify-center"><Film className="size-7" style={{ color: cfg.c.accent }} /></div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-medium">{movie.title}</span>
          <span className="text-xs text-muted-foreground">{movie.entry_date}</span>
          <button className="invisible ml-auto text-muted-foreground hover:text-destructive group-hover:visible" onClick={() => onDelete(movie.id)}>
            <Trash2 className="size-4" />
          </button>
        </div>
        <div className="mt-1"><Stars value={rating} onChange={(v) => onPatch(movie.id, { rating: v })} accent={cfg.c.accent} /></div>
        <textarea
          defaultValue={movie.body ?? ""}
          onBlur={(e) => onPatch(movie.id, { __body: e.target.value })}
          placeholder="观后感"
          className="mt-1.5 min-h-16 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-1 focus:ring-primary/40"
        />
      </div>
    </div>
  );
}

function Card() {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    listAllEntries()
      .then((es) => setN(es.filter((e) => e.kind !== "note").length))
      .catch(() => setN(0));
  }, []);
  return <p className="text-sm text-muted-foreground">{n === null ? "加载中…" : `六大板块共 ${n} 条记录`}</p>;
}

function Page() {
  const [all, setAll] = useState<Entry[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [openBookId, setOpenBookId] = useState<string | null>(null);

  const reload = useCallback(() => {
    listAllEntries().then(setAll);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  const cfg = board ? BOARDS.find((b) => b.key === board)! : null;

  async function addLearning(kind: string, title: string, body: string) {
    const e = await createEntry({ board: board!, kind, entry_date: todayStr(), title, body });
    setAll((a) => [e, ...a]);
  }
  async function addBook(title: string) {
    const e = await createEntry({ board: "book", kind: "book", title, entry_date: todayStr(), status: "reading" });
    setAll((a) => [e, ...a]);
  }
  async function addMovie(title: string) {
    const e = await createEntry({ board: "movie", kind: "movie", title, entry_date: todayStr(), status: "done" });
    setAll((a) => [e, ...a]);
  }
  async function addNote(bookId: string, body: string) {
    const e = await createEntry({ board: "book", kind: "note", entry_date: todayStr(), body, meta: JSON.stringify({ book_id: bookId }) });
    setAll((a) => [e, ...a]);
  }
  /** patch: 特殊键 __body 写 body 列；其余并进 meta（status/finish_date 特判） */
  async function patchEntry(id: string, patch: Record<string, unknown>) {
    const cur = all.find((e) => e.id === id);
    if (!cur) return;
    const dbPatch: Record<string, unknown> = {};
    const metaPatch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (k === "__body") dbPatch.body = v;
      else if (k === "status") dbPatch.status = v;
      else metaPatch[k] = v;
    }
    if (Object.keys(metaPatch).length > 0) dbPatch.meta = withMeta(cur, metaPatch);
    setAll((a) => a.map((e) => (e.id === id ? { ...e, ...("body" in dbPatch ? { body: dbPatch.body as string } : {}), ...("status" in dbPatch ? { status: dbPatch.status as string } : {}), ...("meta" in dbPatch ? { meta: dbPatch.meta as string } : {}) } : e)));
    await updateEntry(id, dbPatch);
  }
  async function del(id: string) {
    setAll((a) => a.filter((e) => e.id !== id));
    await deleteEntry(id);
  }

  const boardEntries = board ? all.filter((e) => e.board === board) : [];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex items-center gap-2">
        {board && (
          <button onClick={() => { setBoard(null); setOpenBookId(null); }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> 学习记录
          </button>
        )}
        <h1 className="text-2xl font-semibold" style={{ color: cfg?.c.text }}>
          {cfg ? cfg.name : "学习记录"}
        </h1>
        {cfg && <span className="text-sm text-muted-foreground">{cfg.hint}</span>}
      </div>

      {!board && <Landing entries={all} onOpen={setBoard} />}

      {board && cfg && (board === "english" || board === "chinese" || board === "ai" || board === "history" || board === "finance") && (
        <LearningBoard cfg={cfg} entries={boardEntries.filter((e) => e.kind !== "note")} onAdd={addLearning} onDelete={del} />
      )}

      {board === "book" && cfg && (
        <BookBoard
          cfg={cfg}
          books={boardEntries.filter((e) => e.kind !== "note")}
          notesByBook={boardEntries.filter((e) => e.kind === "note").reduce((m, n) => {
            const bid = metaGet(n, "book_id");
            if (!m.has(bid)) m.set(bid, []);
            m.get(bid)!.push(n);
            return m;
          }, new Map<string, Entry[]>())}
          openId={openBookId}
          onOpenBook={setOpenBookId}
          onAdd={addBook}
          onPatch={patchEntry}
          onDelete={del}
          onAddNote={addNote}
          onDeleteNote={del}
        />
      )}

      {board === "movie" && cfg && (
        <MovieBoard cfg={cfg} movies={boardEntries.filter((e) => e.kind !== "note")} onAdd={addMovie} onPatch={patchEntry} onDelete={del} />
      )}
    </div>
  );
}

const studyLogModule: AppModule = {
  manifest: {
    id: "study-log",
    name: "学习记录",
    icon: BookOpen,
    description: "英语/语文/AI/历史/书籍/电影 六大板块",
    defaultSize: { w: 1, h: 1 },
  },
  Card,
  Page,
};

export default studyLogModule;
