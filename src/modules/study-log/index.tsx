import { useCallback, useEffect, useState } from "react";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { todayStr } from "@/lib/dates";
import type { AppModule } from "../types";
import {
  countByBoard,
  createEntry,
  deleteEntry,
  listEntries,
  updateEntry,
  type Board,
  type Entry,
} from "./data";

const BOARDS: { key: Board; name: string; kinds?: string[]; hint: string }[] = [
  { key: "english", name: "英语", kinds: ["精读文章", "背诵", "谚语"], hint: "每日精读 + 背诵 + 谚语（在对话里喊我更新，内容贴进来存档）" },
  { key: "chinese", name: "语文", kinds: ["成语", "古诗", "练笔"], hint: "成语配典故 · 古诗 · 练笔（输出最提升）" },
  { key: "ai", name: "AI", kinds: ["新闻", "术语卡"], hint: "每日 5 条新闻（带「对 AI PM 的意义」）+ 术语卡" },
  { key: "history", name: "历史", kinds: ["时间线", "事件/人物"], hint: "先骨架后血肉：时间线框架 + 每日一卡" },
  { key: "book", name: "书籍", hint: "在读/读过的书 + 读后感" },
  { key: "movie", name: "电影", hint: "看过的电影 + 观后感" },
];

function metaFinish(e: Entry): string | null {
  try {
    return e.meta ? (JSON.parse(e.meta).finish_date ?? null) : null;
  } catch {
    return null;
  }
}

// ---- 顶层组件（含输入框的必须放模块顶层，否则父组件重渲染会让输入失焦）----

/** 通用板块的新增表单（英语/语文/AI/历史） */
function AddEntryForm({
  kinds,
  onAdd,
}: {
  kinds: string[];
  onAdd: (kind: string, title: string, body: string) => void;
}) {
  const [kind, setKind] = useState(kinds[0]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  function submit() {
    if (!title.trim() && !body.trim()) return;
    onAdd(kind, title.trim(), body.trim());
    setTitle("");
    setBody("");
  }
  return (
    <div className="mb-5 rounded-xl border bg-muted/30 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-md border">
          {kinds.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={cn(
                "px-3 py-1 text-sm transition-colors",
                kind === k ? "bg-primary text-primary-foreground" : "hover:bg-accent",
              )}
            >
              {k}
            </button>
          ))}
        </div>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="标题（如：精读 Day1 / 术语：RAG）"
          className="min-w-48 flex-1"
        />
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="内容——把我在对话里给你的贴到这里存档"
        className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40"
      />
      <div className="mt-2 flex justify-end">
        <Button size="sm" onClick={submit}>
          <Plus className="size-4" /> 添加
        </Button>
      </div>
    </div>
  );
}

/** 通用条目卡：标题(可改) + 内容(可改) + 删除；用非受控 defaultValue + onBlur 存 */
function EntryCard({
  entry,
  onSaveTitle,
  onSaveBody,
  onDelete,
}: {
  entry: Entry;
  onSaveTitle: (id: string, v: string) => void;
  onSaveBody: (id: string, v: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="group rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        {entry.kind && (
          <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
            {entry.kind}
          </span>
        )}
        {entry.entry_date && (
          <span className="shrink-0 text-xs text-muted-foreground">{entry.entry_date}</span>
        )}
        <input
          defaultValue={entry.title ?? ""}
          onBlur={(e) => onSaveTitle(entry.id, e.target.value)}
          placeholder="标题"
          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none"
        />
        <button
          className="invisible shrink-0 text-muted-foreground hover:text-destructive group-hover:visible"
          title="删除"
          onClick={() => onDelete(entry.id)}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <textarea
        defaultValue={entry.body ?? ""}
        onBlur={(e) => onSaveBody(entry.id, e.target.value)}
        placeholder="内容"
        className="mt-2 min-h-20 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-1 focus:ring-primary/40"
      />
    </div>
  );
}

/** 书籍卡：标题 + 在读/读完切换 + 起止日 + 读后感 */
function BookCard({
  entry,
  onSaveTitle,
  onSaveBody,
  onToggleDone,
  onDelete,
}: {
  entry: Entry;
  onSaveTitle: (id: string, v: string) => void;
  onSaveBody: (id: string, v: string) => void;
  onToggleDone: (entry: Entry) => void;
  onDelete: (id: string) => void;
}) {
  const done = entry.status === "done";
  const finish = metaFinish(entry);
  return (
    <div className="group rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs",
            done ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700",
          )}
        >
          {done ? "读完" : "在读"}
        </span>
        <input
          defaultValue={entry.title ?? ""}
          onBlur={(e) => onSaveTitle(entry.id, e.target.value)}
          placeholder="书名"
          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none"
        />
        <button
          onClick={() => onToggleDone(entry)}
          className="shrink-0 rounded-md border px-2.5 py-1 text-xs text-primary hover:bg-accent"
        >
          {done ? "重新在读" : "标记读完"}
        </button>
        <button
          className="invisible shrink-0 text-muted-foreground hover:text-destructive group-hover:visible"
          title="删除"
          onClick={() => onDelete(entry.id)}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        开始 {entry.entry_date ?? "—"}
        {done && `　·　读完 ${finish ?? "—"}`}
      </p>
      <textarea
        defaultValue={entry.body ?? ""}
        onBlur={(e) => onSaveBody(entry.id, e.target.value)}
        placeholder="读后感（读的过程中随时写，读完必写一篇）"
        className="mt-2 min-h-20 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-1 focus:ring-primary/40"
      />
    </div>
  );
}

/** 电影卡：片名 + 观影日 + 观后感 */
function MovieCard({
  entry,
  onSaveTitle,
  onSaveBody,
  onDelete,
}: {
  entry: Entry;
  onSaveTitle: (id: string, v: string) => void;
  onSaveBody: (id: string, v: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="group rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-xs text-muted-foreground">{entry.entry_date ?? "—"}</span>
        <input
          defaultValue={entry.title ?? ""}
          onBlur={(e) => onSaveTitle(entry.id, e.target.value)}
          placeholder="片名"
          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none"
        />
        <button
          className="invisible shrink-0 text-muted-foreground hover:text-destructive group-hover:visible"
          title="删除"
          onClick={() => onDelete(entry.id)}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <textarea
        defaultValue={entry.body ?? ""}
        onBlur={(e) => onSaveBody(entry.id, e.target.value)}
        placeholder="观后感"
        className="mt-2 min-h-20 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-1 focus:ring-primary/40"
      />
    </div>
  );
}

/** 书籍/电影用的「加一条」单行表单 */
function AddTitleForm({ placeholder, cta, onAdd }: { placeholder: string; cta: string; onAdd: (t: string) => void }) {
  const [t, setT] = useState("");
  function submit() {
    if (!t.trim()) return;
    onAdd(t.trim());
    setT("");
  }
  return (
    <div className="mb-5 flex max-w-md gap-2">
      <Input
        value={t}
        onChange={(e) => setT(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder={placeholder}
      />
      <Button onClick={submit}>
        <Plus className="size-4" /> {cta}
      </Button>
    </div>
  );
}

function Card() {
  const [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    countByBoard()
      .then((m) => setTotal(Object.values(m).reduce((a, b) => a + b, 0)))
      .catch(() => setTotal(0));
  }, []);
  return (
    <p className="text-sm text-muted-foreground">
      {total === null ? "加载中…" : `六大板块共 ${total} 条记录`}
    </p>
  );
}

function Page() {
  const [board, setBoard] = useState<Board>("english");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const cfg = BOARDS.find((b) => b.key === board)!;

  const reload = useCallback(() => {
    setLoading(true);
    listEntries(board)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [board]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function addGeneric(kind: string, title: string, body: string) {
    const e = await createEntry({ board, kind, entry_date: todayStr(), title, body });
    setEntries((es) => [e, ...es]);
  }
  async function addBook(title: string) {
    const e = await createEntry({ board: "book", title, entry_date: todayStr(), status: "reading" });
    setEntries((es) => [e, ...es]);
  }
  async function addMovie(title: string) {
    const e = await createEntry({ board: "movie", title, entry_date: todayStr(), status: "done" });
    setEntries((es) => [e, ...es]);
  }
  function saveTitle(id: string, v: string) {
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, title: v } : e)));
    updateEntry(id, { title: v });
  }
  function saveBody(id: string, v: string) {
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, body: v } : e)));
    updateEntry(id, { body: v });
  }
  async function toggleBookDone(entry: Entry) {
    const done = entry.status === "done";
    const status = done ? "reading" : "done";
    const meta = done ? null : JSON.stringify({ finish_date: todayStr() });
    setEntries((es) => es.map((e) => (e.id === entry.id ? { ...e, status, meta } : e)));
    await updateEntry(entry.id, { status, meta });
  }
  async function del(id: string) {
    setEntries((es) => es.filter((e) => e.id !== id));
    await deleteEntry(id);
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-1 text-2xl font-semibold">学习记录</h1>
      <p className="mb-4 text-sm text-muted-foreground">{cfg.hint}</p>

      {/* 六大板块切换（英语/语文 · AI/历史 · 书籍/电影） */}
      <div className="mb-5 grid grid-cols-3 gap-1.5 sm:inline-grid sm:grid-cols-6">
        {BOARDS.map((b) => (
          <button
            key={b.key}
            onClick={() => setBoard(b.key)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              board === b.key
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-accent",
            )}
          >
            {b.name}
          </button>
        ))}
      </div>

      {/* 新增区 */}
      {board === "book" ? (
        <AddTitleForm placeholder="书名（开始读就加进来）" cta="开始读" onAdd={addBook} />
      ) : board === "movie" ? (
        <AddTitleForm placeholder="片名（看完记一部）" cta="记一部" onAdd={addMovie} />
      ) : (
        <AddEntryForm kinds={cfg.kinds!} onAdd={addGeneric} />
      )}

      {/* 列表 */}
      {loading ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : entries.length === 0 ? (
        <p className="py-10 text-sm text-muted-foreground">
          还没有记录。{board === "book" || board === "movie" ? "上面加一条开始。" : "在对话里喊我生成今天的内容，贴进来存档。"}
        </p>
      ) : (
        <div className="space-y-3">
          {entries.map((e) =>
            board === "book" ? (
              <BookCard key={e.id} entry={e} onSaveTitle={saveTitle} onSaveBody={saveBody} onToggleDone={toggleBookDone} onDelete={del} />
            ) : board === "movie" ? (
              <MovieCard key={e.id} entry={e} onSaveTitle={saveTitle} onSaveBody={saveBody} onDelete={del} />
            ) : (
              <EntryCard key={e.id} entry={e} onSaveTitle={saveTitle} onSaveBody={saveBody} onDelete={del} />
            ),
          )}
        </div>
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
