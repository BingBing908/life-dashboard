import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Film, Library, Star, Trash2 } from "lucide-react";
import { QuickAdd } from "@/components/QuickAdd";
import { cn } from "@/lib/utils";
import { CARD, CARD_TITLE, PAGE } from "@/lib/ui";
import { todayStr } from "@/lib/dates";
import { useSubPath } from "@/lib/hashRoute";
import type { AppModule } from "../types";
import {
  createEntry,
  deleteEntry,
  listAllEntries,
  updateEntry,
  type Entry,
} from "../study-log/data";

/**
 * 书架（书籍 + 电影）——2026-09-01 从「日日学」里拆出来单开一页。
 *
 * ⚠️ **为什么要拆**（Rosie 提的，我同意）：日日学是**每日喂养**——我每天推内容进去、
 * 有复习队列、有作业、有「今日看完」的判定。而书影是**长期收藏**——她自己录入、
 * 没有每日节奏、不进复习、不出作业。**两者生命周期完全不同，放一起本来就别扭**，
 * 而且 2026-09-01 重定向之后日日学要聚焦 AI/PM 主线，书影更不该占那六个格子之一。
 *
 * ⚠️ **数据没搬**：仍然存在 `study_entries` 表里（board='book'/'movie'），
 * 复用 `study-log/data.ts` 的读写函数。拆的只是**入口和 UI**，不是数据——
 * 所以零迁移、零风险，她已有的书和读后感照旧。
 *
 * ⚠️ **路由变了**：原来翻开一本书是 `#/study-log/book/<id>`，现在是 `#/bookshelf/<id>`。
 */

/** 书/影两个板块的配色和图标（原来在 study-log 的 BOARDS 里，拆出来后独立定义） */
interface ShelfCfg {
  key: "book" | "movie";
  name: string;
  icon: typeof Library;
  hint: string;
  c: { bg: string; text: string; sub: string; accent: string };
}
const SHELVES: ShelfCfg[] = [
  { key: "book", name: "书籍", icon: Library, hint: "在读/读过的书 + 读后感", c: { bg: "#E1F5EE", text: "#085041", sub: "#0F6E56", accent: "#1D9E75" } },
  { key: "movie", name: "电影", icon: Film, hint: "看过的电影 + 观后感", c: { bg: "#FBEAF0", text: "#72243E", sub: "#993556", accent: "#D4537E" } },
];
/** 搬过来的组件原来用的是 study-log 的 BoardCfg，这里用结构相同的 ShelfCfg 顶上 */
type BoardCfg = ShelfCfg;

function metaGet(e: Entry, key: string): string {
  try {
    const m = e.meta ? JSON.parse(e.meta) : {};
    return typeof m[key] === "string" ? m[key] : "";
  } catch {
    return "";
  }
}

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
  return (
    <div className="mb-5 max-w-md">
      <QuickAdd placeholder={placeholder} cta={cta} onAdd={onAdd} />
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
        // 2026-09-18 Rosie：「每本书界面太大，缩小为现在的 1/4」。面积 1/4＝列数翻倍
        // （2→4、3→6），页面全宽，宽屏再补 xl:8 / 2xl:10，免得列少时封面又被拉大。
        // ⚠️ 这里是三元的分支，注释必须是 // 形式——JSX 的 {/* */} 放在 ( 后面是语法错误（CI 抓过）。
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
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
          <h2 className={CARD_TITLE}>{book.title}</h2>
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
        <div className="mb-2">
          <QuickAdd placeholder="今天看到哪了 / 随手写点想法" cta="记一笔" onAdd={(v) => onAddNote(book.id, v)} />
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
    <div className={cn(CARD, "group flex gap-3")}>
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


/** withMeta：把 patch 并进现有 meta（从 study-log 搬来的同一套逻辑） */
function withMeta(e: Entry, patch: Record<string, unknown>): string {
  let m: Record<string, unknown> = {};
  try {
    m = e.meta ? JSON.parse(e.meta) : {};
  } catch {
    m = {};
  }
  return JSON.stringify({ ...m, ...patch });
}

/** 仪表盘摘要卡 */
function Card() {
  const [n, setN] = useState<{ book: number; movie: number } | null>(null);
  useEffect(() => {
    listAllEntries()
      .then((all) =>
        setN({
          book: all.filter((e) => e.board === "book" && e.kind !== "note").length,
          movie: all.filter((e) => e.board === "movie" && e.kind !== "note").length,
        }),
      )
      .catch(() => setN({ book: 0, movie: 0 }));
  }, []);
  if (!n) return <p className="text-sm text-muted-foreground">加载中…</p>;
  if (n.book + n.movie === 0)
    return <p className="text-sm text-muted-foreground">还没有书和电影。报个书名，我给它找封面。</p>;
  return (
    <p className="text-sm text-muted-foreground">
      {n.book} 本书 · {n.movie} 部电影
    </p>
  );
}

function Page() {
  const [all, setAll] = useState<Entry[]>([]);
  // 翻开的那本书进 URL（#/bookshelf/<书id>），在书里刷新不会被弹回书架
  const [sub, nav] = useSubPath("bookshelf");
  const openId = sub[0] ?? null;
  const [shelf, setShelf] = useState<"book" | "movie">("book");

  const reload = useCallback(() => {
    listAllEntries()
      .then((a) => setAll(a.filter((e) => e.board === "book" || e.board === "movie")))
      .catch(() => {});
  }, []);
  useEffect(reload, [reload]);

  async function addBook(title: string) {
    const e = await createEntry({ board: "book", kind: "book", title, entry_date: todayStr(), status: "reading" });
    setAll((a) => [e, ...a]);
  }
  async function addMovie(title: string) {
    const e = await createEntry({ board: "movie", kind: "movie", title, entry_date: todayStr(), status: "done" });
    setAll((a) => [e, ...a]);
  }
  async function addNote(bookId: string, body: string) {
    const e = await createEntry({
      board: "book",
      kind: "note",
      entry_date: todayStr(),
      body,
      meta: JSON.stringify({ book_id: bookId }),
    });
    setAll((a) => [e, ...a]);
  }
  /** patch：特殊键 __body 写 body 列、status 写 status 列，其余并进 meta */
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
    setAll((a) =>
      a.map((e) =>
        e.id === id
          ? {
              ...e,
              ...("body" in dbPatch ? { body: dbPatch.body as string } : {}),
              ...("status" in dbPatch ? { status: dbPatch.status as string } : {}),
              ...("meta" in dbPatch ? { meta: dbPatch.meta as string } : {}),
            }
          : e,
      ),
    );
    await updateEntry(id, dbPatch);
  }
  async function del(id: string) {
    setAll((a) => a.filter((e) => e.id !== id));
    await deleteEntry(id);
    // 删掉的正是当前翻开的那本 ⇒ 别停在死 id 上（同 mini-table 那条坑）
    if (id === openId) nav([]);
  }

  const bookCfg = SHELVES[0];
  const movieCfg = SHELVES[1];
  const books = all.filter((e) => e.board === "book" && e.kind !== "note");
  const movies = all.filter((e) => e.board === "movie" && e.kind !== "note");
  const notesByBook = all
    .filter((e) => e.board === "book" && e.kind === "note")
    .reduce((m, n) => {
      const bid = metaGet(n, "book_id");
      if (!m.has(bid)) m.set(bid, []);
      m.get(bid)!.push(n);
      return m;
    }, new Map<string, Entry[]>());

  // 翻开了某本书 ⇒ 直接进书籍视图（BookBoard 内部按 openId 渲染本子）
  const activeShelf = openId ? "book" : shelf;

  return (
    <div className={PAGE}>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">书架</h1>
        <span className="text-sm text-muted-foreground">
          自己录入的长期收藏 · 不进复习、不出作业
        </span>
      </div>

      {/* 书/影切换。刻意不做成两个模块——它俩形态一样（封面墙 + 评分 + 感想），
          共用一页比占两个侧栏入口划算 */}
      {!openId && (
        <div className="mb-4 flex gap-2">
          {SHELVES.map((s) => (
            <button
              key={s.key}
              onClick={() => setShelf(s.key)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                activeShelf === s.key ? "font-medium" : "text-muted-foreground hover:bg-accent",
              )}
              style={
                activeShelf === s.key
                  ? { background: s.c.bg, borderColor: s.c.accent, color: s.c.text }
                  : undefined
              }
            >
              <s.icon className="mr-1 inline size-4" style={{ color: s.c.accent }} />
              {s.name}
              <span className="ml-1.5 text-xs opacity-70">
                {s.key === "book" ? books.length : movies.length}
              </span>
            </button>
          ))}
        </div>
      )}

      {activeShelf === "book" ? (
        <BookBoard
          cfg={bookCfg}
          books={books}
          notesByBook={notesByBook}
          openId={openId}
          onOpenBook={(id) => nav(id ? [id] : [])}
          onAdd={addBook}
          onPatch={patchEntry}
          onDelete={del}
          onAddNote={addNote}
          onDeleteNote={del}
        />
      ) : (
        <MovieBoard cfg={movieCfg} movies={movies} onAdd={addMovie} onPatch={patchEntry} onDelete={del} />
      )}
    </div>
  );
}

const bookshelfModule: AppModule = {
  manifest: {
    id: "bookshelf",
    name: "书架",
    icon: Library,
    description: "书籍 + 电影的长期收藏",
    defaultSize: { w: 1, h: 1 },
  },
  Card,
  Page,
};

export default bookshelfModule;
