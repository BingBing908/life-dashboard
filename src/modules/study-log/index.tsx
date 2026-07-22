import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Film,
  Landmark,
  Layers,
  Library,
  LineChart,
  PenLine,
  Plus,
  RotateCcw,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuickAdd } from "@/components/QuickAdd";
import { cn } from "@/lib/utils";
import { addDays, todayStr } from "@/lib/dates";
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

// 复习不进 BOARDS（不占大磁贴），单独一个小按钮进入
const REVIEW_CFG: BoardCfg = { key: "review", name: "复习", icon: RotateCcw, hint: "先默写昨天的古诗 + 英语精读，再看答案", c: { bg: "#FCEBEB", text: "#791F1F", sub: "#A32D2D", accent: "#E24B4A" } };

const BOARDS: BoardCfg[] = [
  { key: "english", name: "英语", icon: BookOpen, kinds: ["精读文章", "背诵", "谚语"], hint: "每日精读 + 背诵 + 谚语", c: { bg: "#E6F1FB", text: "#0C447C", sub: "#185FA5", accent: "#378ADD" } },
  { key: "chinese", name: "语文", icon: PenLine, kinds: ["成语", "谚语", "古诗", "练笔"], hint: "每日成语+谚语 · 古诗背诵 · 练笔输出", c: { bg: "#FAECE7", text: "#712B13", sub: "#993C1D", accent: "#D85A30" } },
  { key: "ai", name: "AI", icon: Sparkles, kinds: ["新闻", "术语卡"], hint: "每日 5 条新闻 + 术语卡", c: { bg: "#EEEDFE", text: "#3C3489", sub: "#534AB7", accent: "#7F77DD" } },
  { key: "history", name: "历史", icon: Landmark, kinds: ["时间线", "事件/人物"], hint: "时间线框架 + 每日一卡", c: { bg: "#FAEEDA", text: "#633806", sub: "#854F0B", accent: "#BA7517" } },
  { key: "finance", name: "金融", icon: LineChart, kinds: ["K线基础", "基金知识", "基金新闻", "我的复盘"], hint: "看懂日线 · 基金入门（教知识、不荐买卖）", c: { bg: "#EAF3DE", text: "#27500A", sub: "#3B6D11", accent: "#639922" } },
  { key: "pm", name: "产品经理", icon: Layers, kinds: ["PM概念", "产品拆解", "练习"], hint: "PM 概念 · AI 产品拆解 · 用自己的项目练表达", c: { bg: "#F1EFE8", text: "#2C2C2A", sub: "#5F5E5A", accent: "#888780" } },
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

/** 需要默写的内容（古诗/英语精读） */
function needsDictation(e: Entry): boolean {
  return e.kind === "古诗" || e.kind === "精读文章";
}
/** 是否「今天看完」：要默写的＝默写过≥1遍才算；其余＝手动标 meta.done */
export function entryDone(e: Entry): boolean {
  let m: Record<string, unknown> = {};
  try {
    m = e.meta ? JSON.parse(e.meta) : {};
  } catch {
    m = {};
  }
  if (needsDictation(e)) {
    const art = (m.artAtt as unknown[]) ?? [];
    const word = (m.wordAtt as unknown[]) ?? [];
    return art.length >= 1 || word.length >= 1;
  }
  return !!m.done;
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
  const today = todayStr();
  const isDone = entryDone;
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
              {b.kinds && (() => {
                const todays = mine.filter((e) => e.entry_date === today && e.kind !== "note");
                return todays.length > 0 ? (
                  <div className="mt-0.5 text-xs" style={{ color: b.c.sub }}>
                    今日 {todays.filter(isDone).length}/{todays.length} 看完
                  </div>
                ) : null;
              })()}
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
                    {(latest.body || b.hint).replace(/\[\[([^\]]+)\]\]/g, "$1")}
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
/** 按日期分组的折叠看板（日日学各板块共用）：今天/最新那天默认展开，每条用 renderItem 渲染 */
function DateGroupedBoard({
  entries,
  cfg,
  renderItem,
  emptyText,
}: {
  entries: Entry[];
  cfg: BoardCfg;
  renderItem: (e: Entry) => React.ReactNode;
  emptyText?: string;
}) {
  const today = todayStr();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const byDate = new Map<string, Entry[]>();
  for (const e of entries) {
    const d = e.entry_date || "未标日期";
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(e);
  }
  const dates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : -1));
  const primary = dates.includes(today) ? today : dates[0];
  if (dates.length === 0) {
    return emptyText ? <p className="py-10 text-sm text-muted-foreground">{emptyText}</p> : null;
  }
  return (
    <div className="space-y-3">
      {dates.map((d) => {
        const isToday = d === today;
        const isOpen = open[d] ?? d === primary;
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
            {isOpen && <div className="space-y-2 px-4 pb-4">{items.map(renderItem)}</div>}
          </section>
        );
      })}
    </div>
  );
}

/** 通用学习板块（AI/历史/金融/PM/语文）：加一条 + 按日期折叠（DateGroupedBoard） */
function LearningBoard({
  cfg,
  entries,
  onAdd,
  onDelete,
  onPatch,
}: {
  cfg: BoardCfg;
  entries: Entry[];
  onAdd: (kind: string, title: string, body: string) => void;
  onDelete: (id: string) => void;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">平时内容我帮你更新；也可以自己加一条</p>
        <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
          <Plus className="size-4" /> 加一条
        </Button>
      </div>
      {adding && <AddEntryForm kinds={cfg.kinds!} onAdd={(k, t, b) => { onAdd(k, t, b); setAdding(false); }} />}
      <DateGroupedBoard
        entries={entries}
        cfg={cfg}
        emptyText={adding ? undefined : `还没有内容。晚上发我「${cfg.name}学完了，换新的」，我更新进来；你打开就能看到。`}
        renderItem={(e) => <EntryDoc key={e.id} entry={e} accent={cfg.c.accent} onDelete={onDelete} onPatch={onPatch} />}
      />
    </div>
  );
}

/** 一条学习内容（展示为主，可删）。body 里 [[术语]] 会渲染成下划线，点开看 meta.glossary 里的释义。 */
function EntryDoc({ entry, accent, onDelete, onPatch }: { entry: Entry; accent: string; onDelete: (id: string) => void; onPatch?: (id: string, patch: Record<string, unknown>) => void }) {
  const [term, setTerm] = useState<string | null>(null);
  const [dict, setDict] = useState(false);
  let meta: Record<string, unknown> = {};
  try {
    meta = entry.meta ? JSON.parse(entry.meta) : {};
  } catch {
    meta = {};
  }
  const glossary = (meta.glossary as Record<string, string>) ?? {};
  const image = meta.image as string | undefined;
  const parts = (entry.body ?? "").split(/(\[\[[^\]]+\]\])/g);
  // 古诗支持默写（复用文章默写；默写时把原文高糊防偷看）
  const artAtt = (meta.artAtt as ArtAtt[]) ?? [];
  const isPoem = entry.kind === "古诗" && !!entry.body && !!onPatch;
  // 只默写「诗本身」：优先 meta.recite；否则从 body 里抽【原诗】段；都没有才退回整段
  const poemMatch = (entry.body ?? "").match(/【原诗】([\s\S]*?)(?=\n*【|$)/);
  const dictTarget = (meta.recite as string) || (poemMatch ? poemMatch[1].trim() : (entry.body ?? ""));
  // 要默写的（古诗）＝默写过才算看完，只读显示；其余＝手动标
  const dictKind = needsDictation(entry);
  const done = entryDone(entry);
  return (
    <div className={cn("group rounded-lg border bg-background p-3", done && "opacity-70")}>
      <div className="flex items-center gap-2">
        {entry.kind && (
          <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: accent + "22", color: accent }}>
            {entry.kind}
          </span>
        )}
        {entry.title && <span className="text-sm font-medium">{entry.title}</span>}
        <div className="ml-auto flex items-center gap-2">
          {onPatch && !dictKind && (
            <button
              onClick={() => onPatch(entry.id, { done: !done })}
              className={cn(
                "shrink-0 rounded-full px-2.5 py-0.5 text-xs transition-colors",
                done ? "bg-emerald-500 text-white" : "border text-muted-foreground hover:bg-accent",
              )}
            >
              {done ? "✓ 已看完" : "标看完"}
            </button>
          )}
          {dictKind && (
            <span
              className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs", done ? "bg-emerald-500 text-white" : "border text-muted-foreground")}
              title="默写过≥1遍才算看完"
            >
              {done ? "✓ 已默写" : "默写后算看完"}
            </span>
          )}
          <button
            className="invisible text-muted-foreground hover:text-destructive group-hover:visible"
            title="删除"
            onClick={() => onDelete(entry.id)}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
      {entry.body && (
        <Blurred active={isPoem && dict}>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {parts.map((p, i) => {
              const m = p.match(/^\[\[([^\]]+)\]\]$/);
              if (m) {
                const t = m[1];
                const active = term === t;
                return (
                  <button
                    key={i}
                    onClick={() => setTerm(active ? null : t)}
                    className="font-medium"
                    style={{ color: accent, borderBottom: `1.5px dotted ${accent}`, background: active ? accent + "18" : "transparent" }}
                  >
                    {t}
                  </button>
                );
              }
              return <span key={i}>{p}</span>;
            })}
          </p>
        </Blurred>
      )}
      {image && <img src={image} alt="配图" className="mt-2 w-full max-w-xl rounded-md border" />}
      {term && glossary[term] && (
        <div className="mt-2 rounded-md border p-2.5 text-sm leading-relaxed" style={{ background: accent + "12", borderColor: accent + "44" }}>
          <span className="font-medium" style={{ color: accent }}>{term}</span>
          <span className="text-foreground/85">：{glossary[term]}</span>
        </div>
      )}
      {isPoem && (
        <div className="mt-2">
          <button onClick={() => setDict((v) => !v)} className="rounded-md px-2.5 py-1 text-xs text-primary-foreground" style={{ background: accent }}>
            {dict ? "收起默写" : `默写这首${artAtt.length ? ` (${artAtt.length}/3)` : ""}`}
          </button>
          {dict && (
            <ArticleDictation
              article={dictTarget}
              attempts={artAtt}
              accent={accent}
              onSave={(a) => onPatch!(entry.id, { artAtt: [...artAtt, a].slice(-3) })}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ---- 英语精读：双译 + 单词本 + 默写（方案 A）----

interface Word { en: string; cn: string }
interface WordItem { en: string; cn: string; a1: string; ok1: boolean; a2: string; ok2: boolean }
interface WordAtt { e2c: { c: number; t: number }; c2e: { c: number; t: number }; items?: WordItem[] }
interface ArtAtt { score: number; mode?: string; text?: string; ref?: string }

/** 把参考原文渲染出来、红标出「答案里没写到」的字/词（中文按字、英文按词）。默写回顾复用。 */
function renderMistakes(ref: string, answer: string) {
  const hasCjk = /[一-鿿]/.test(ref);
  const tokSet = new Set(
    hasCjk ? (answer.match(/[一-鿿]/g) ?? []) : (answer.toLowerCase().match(/[a-z']+/g) ?? []),
  );
  const segs = hasCjk ? [...ref] : ref.split(/([a-zA-Z']+)/);
  return segs.map((seg, i) => {
    const isTok = hasCjk ? /[一-鿿]/.test(seg) : /[a-zA-Z']/.test(seg);
    const miss = isTok && !tokSet.has(hasCjk ? seg : seg.toLowerCase());
    return miss ? (
      <mark key={i} className="rounded bg-red-100 px-0.5 font-medium text-red-700">{seg}</mark>
    ) : (
      <span key={i}>{seg}</span>
    );
  });
}

/** 默写回顾：显示「你写的」+ 参考原文（红＝漏/错）。古诗/英语文章默写复用。 */
function DictReview({ answer, refText, refLabel = "原文" }: { answer: string; refText?: string; refLabel?: string }) {
  return (
    <div className="mt-2 space-y-1.5 text-sm">
      <div>
        <span className="text-muted-foreground">你写的：</span>
        <span className="whitespace-pre-wrap">{answer?.trim() ? answer : "（空）"}</span>
      </div>
      {refText && (
        <div>
          <span className="text-muted-foreground">{refLabel}（红＝你漏写/写错的）：</span>
          <p className="mt-1 whitespace-pre-wrap rounded-md border bg-background p-2.5 leading-relaxed">{renderMistakes(refText, answer)}</p>
        </div>
      )}
    </div>
  );
}

function parseMetaObj(e: Entry): Record<string, unknown> {
  try {
    return e.meta ? JSON.parse(e.meta) : {};
  } catch {
    return {};
  }
}
const normEn = (s: string) => (s || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const normCn = (s: string) => (s || "").replace(/[\s，。,.、；;！!？?"'“”‘’（）()]/g, "").trim();
const cnOk = (u: string, a: string) => {
  const x = normCn(u), y = normCn(a);
  return !!x && (x === y || y.includes(x) || x.includes(y));
};
const enOk = (u: string, a: string) => {
  const x = normEn(u), y = normEn(a);
  return !!x && x === y;
};
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 默写时把内容「高糊」（看不清→不会偷看）；文章和单词本复用同一个组件 */
function Blurred({ active, children }: { active: boolean; children: React.ReactNode }) {
  return <div className={cn("transition", active && "pointer-events-none select-none blur-md")}>{children}</div>;
}

/** 单词本：可增删（会的删、缺的加）；默写时高糊；点默写单词进听写 */
function WordBook({
  words,
  wordAtt,
  mode,
  onSetMode,
  onWords,
  accent,
}: {
  words: Word[];
  wordAtt: WordAtt[];
  mode: "none" | "word" | "article";
  onSetMode: (m: "none" | "word" | "article") => void;
  onWords: (w: Word[]) => void;
  accent: string;
}) {
  const [adding, setAdding] = useState(false);
  const [en, setEn] = useState("");
  const [cn, setCn] = useState("");
  function add() {
    if (!en.trim()) return;
    onWords([...words, { en: en.trim(), cn: cn.trim() }]);
    setEn(""); setCn(""); setAdding(false);
  }
  return (
    <div className="rounded-md border p-2.5" style={{ background: accent + "0d" }}>
      <p className="mb-1.5 text-xs text-muted-foreground">单词本 · {words.length}（生词/短语，可增删）</p>
      <Blurred active={mode === "word"}>
        <div className="space-y-0.5">
          {words.map((w, i) => (
            <div key={i} className="group flex items-center gap-1 text-sm">
              <span className="font-medium">{w.en}</span>
              {w.cn && <span className="text-xs text-muted-foreground">{w.cn}</span>}
              <button
                className="invisible ml-auto shrink-0 text-muted-foreground hover:text-destructive group-hover:visible"
                title="删除（这个我会）"
                onClick={() => onWords(words.filter((_, idx) => idx !== i))}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </Blurred>
      {mode === "word" && <p className="mt-1 text-[11px] text-muted-foreground">默写中，单词本已模糊</p>}
      {mode !== "word" && (
        adding ? (
          <div className="mt-2 space-y-1">
            <input value={en} onChange={(e) => setEn(e.target.value)} placeholder="生词/短语" className="h-7 w-full rounded border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-primary/40" />
            <input value={cn} onChange={(e) => setCn(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="中文意思" className="h-7 w-full rounded border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-primary/40" />
            <div className="flex gap-1">
              <button onClick={add} className="flex-1 rounded px-2 py-1 text-xs text-primary-foreground" style={{ background: accent }}>加入</button>
              <button onClick={() => { setAdding(false); setEn(""); setCn(""); }} className="rounded border px-2 py-1 text-xs">取消</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-dashed py-1 text-xs text-muted-foreground hover:bg-accent">
            <Plus className="size-3.5" /> 加生词/短语
          </button>
        )
      )}
      {words.length > 0 && (
        <button onClick={() => onSetMode(mode === "word" ? "none" : "word")} className="mt-2 w-full rounded-md px-2 py-1 text-xs text-primary-foreground" style={{ background: accent }}>
          {mode === "word" ? "收起默写" : `默写单词${wordAtt.length ? ` (${wordAtt.length}/3)` : ""}`}
        </button>
      )}
    </div>
  );
}

/** 单词默写：英译中 → 批改 → 中译英 → 批改 → 完成本遍；三遍留存对比 */
function WordDictation({ words, attempts, onSave, accent }: { words: Word[]; attempts: WordAtt[]; onSave: (a: WordAtt) => void; accent: string }) {
  const [order, setOrder] = useState<Word[]>(() => shuffle(words));
  const [phase, setPhase] = useState<"e2c" | "c2e">("e2c");
  const [e2c, setE2c] = useState<Record<number, string>>({});
  const [c2e, setC2e] = useState<Record<number, string>>({});
  const [gE, setGE] = useState(false);
  const [gC, setGC] = useState(false);
  const [view, setView] = useState<number | null>(null); // 看第几遍；null=正在写

  function reset() {
    setOrder(shuffle(words)); setPhase("e2c"); setE2c({}); setC2e({}); setGE(false); setGC(false); setView(null);
  }
  function finish() {
    const items: WordItem[] = order.map((w, i) => ({
      en: w.en, cn: w.cn,
      a1: e2c[i] ?? "", ok1: cnOk(e2c[i] ?? "", w.cn),
      a2: c2e[i] ?? "", ok2: enOk(c2e[i] ?? "", w.en),
    }));
    onSave({
      e2c: { c: items.filter((x) => x.ok1).length, t: order.length },
      c2e: { c: items.filter((x) => x.ok2).length, t: order.length },
      items,
    });
    reset();
  }

  const tabs = (
    <div className="mb-2 flex flex-wrap items-center gap-1.5">
      {attempts.map((a, i) => (
        <button key={i} onClick={() => setView(i)} className={cn("rounded-full border px-2.5 py-0.5 text-xs", view === i ? "text-primary-foreground" : "")} style={view === i ? { background: accent, borderColor: accent } : undefined}>
          第{i + 1}遍 {a.e2c.c + a.c2e.c}/{a.e2c.t + a.c2e.t}
        </button>
      ))}
      {(
        <button onClick={() => setView(null)} className={cn("rounded-full border px-2.5 py-0.5 text-xs", view === null ? "text-primary-foreground" : "")} style={view === null ? { background: accent, borderColor: accent } : undefined}>
          ✏️ 写{attempts.length ? "新一遍" : ""}
        </button>
      )}
    </div>
  );

  if (view !== null && attempts[view]) {
    const a = attempts[view];
    return (
      <div className="mt-3 rounded-lg border p-3" style={{ borderColor: accent + "55" }}>
        {tabs}
        <p className="text-sm">第 {view + 1} 遍：英译中 <b>{a.e2c.c}/{a.e2c.t}</b> · 中译英 <b>{a.c2e.c}/{a.c2e.t}</b></p>
        {a.items && a.items.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {a.items.map((it, i) => (
              <div key={i} className="rounded-md border bg-background px-2.5 py-1.5 text-xs">
                <span className="font-medium">{it.en}</span> · {it.cn}
                <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5">
                  <span>英译中：{it.ok1 ? <span className="text-emerald-600">✓ {it.a1 || "（空）"}</span> : <span className="text-red-600">✗ 你写「{it.a1 || "空"}」，应「{it.cn}」</span>}</span>
                  <span>中译英：{it.ok2 ? <span className="text-emerald-600">✓ {it.a2 || "（空）"}</span> : <span className="text-red-600">✗ 你写「{it.a2 || "空"}」，应「{it.en}」</span>}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {attempts.length > 1 && <p className="mt-1.5 text-xs text-muted-foreground">切换标签对比各遍，看有没有进步。</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border p-3" style={{ borderColor: accent + "55" }}>
      {tabs}
      <p className="mb-2 text-sm font-medium">{phase === "e2c" ? "① 英译中（看英文，写中文）" : "② 中译英（看中文，写英文）"}</p>
      <div className="space-y-1.5">
        {order.map((w, i) => {
          const val = phase === "e2c" ? (e2c[i] ?? "") : (c2e[i] ?? "");
          const graded = phase === "e2c" ? gE : gC;
          const ok = phase === "e2c" ? cnOk(val, w.cn) : enOk(val, w.en);
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-sm">{phase === "e2c" ? w.en : w.cn} →</span>
              <input
                value={val}
                onChange={(e) => (phase === "e2c" ? setE2c((s) => ({ ...s, [i]: e.target.value })) : setC2e((s) => ({ ...s, [i]: e.target.value })))}
                className="h-8 flex-1 rounded-md border bg-background px-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/40"
                placeholder={phase === "e2c" ? "中文意思" : "English"}
              />
              {graded && (ok ? <span className="text-sm text-emerald-600">✓</span> : <span className="shrink-0 text-xs text-red-600">✗ {phase === "e2c" ? w.cn : w.en}</span>)}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {phase === "e2c" && !gE && <Button size="sm" onClick={() => setGE(true)}>批改</Button>}
        {phase === "e2c" && gE && <Button size="sm" onClick={() => setPhase("c2e")}>下一步：中译英</Button>}
        {phase === "c2e" && !gC && <Button size="sm" onClick={() => setGC(true)}>批改</Button>}
        {phase === "c2e" && gC && <Button size="sm" onClick={finish}>完成本遍</Button>}
      </div>
    </div>
  );
}

/** 文章默写：写→批改（按词命中率+标出漏词）；三遍留存 */
function ArticleDictation({ article, attempts, onSave, accent }: { article: string; attempts: ArtAtt[]; onSave: (a: ArtAtt) => void; accent: string }) {
  const [text, setText] = useState("");
  const [graded, setGraded] = useState(false);
  const [view, setView] = useState<number | null>(null);

  // 中文按「字」判、英文按「词」判：有汉字就按汉字命中率，否则按英文单词
  const tok = (s: string) => {
    const cjk = s.match(/[一-鿿]/g);
    return cjk && cjk.length ? cjk : (s.toLowerCase().match(/[a-z']+/g) ?? []);
  };
  const expSet = new Set(tok(article));
  const gotSet = new Set(tok(text));
  const missing = [...expSet].filter((w) => !gotSet.has(w));
  const score = expSet.size ? Math.round(((expSet.size - missing.length) / expSet.size) * 100) : 0;
  function finish() {
    onSave({ score, text, ref: article });
    setText(""); setGraded(false); setView(null);
  }
  const tabs = (
    <div className="mb-2 flex flex-wrap items-center gap-1.5">
      {attempts.map((a, i) => (
        <button key={i} onClick={() => setView(i)} className="rounded-full border px-2.5 py-0.5 text-xs" style={view === i ? { background: accent, borderColor: accent, color: "#fff" } : undefined}>
          第{i + 1}遍 {a.score}%
        </button>
      ))}
      {(
        <button onClick={() => setView(null)} className="rounded-full border px-2.5 py-0.5 text-xs" style={view === null ? { background: accent, borderColor: accent, color: "#fff" } : undefined}>
          ✏️ 写{attempts.length ? "新一遍" : ""}
        </button>
      )}
    </div>
  );
  if (view !== null && attempts[view]) {
    const a = attempts[view];
    return (
      <div className="mt-3 rounded-lg border p-3" style={{ borderColor: accent + "55" }}>
        {tabs}
        <p className="text-sm">第 {view + 1} 遍命中 <b>{a.score}%</b>{attempts.length > 1 && "（切标签对比进步）"}</p>
        {a.text != null && <DictReview answer={a.text} refText={a.ref ?? article} />}
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-lg border p-3" style={{ borderColor: accent + "55" }}>
      {tabs}
      <p className="mb-2 text-sm font-medium">默写（凭记忆写出原文）</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="在这里默写整篇……" className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-1 focus:ring-primary/40" />
      {graded && (
        <div className="mt-2 text-sm">
          <p className="mb-1">命中 <b>{score}%</b>（{expSet.size - missing.length}/{expSet.size} 个）{missing.length === 0 && "，全对，太棒了！"}</p>
          {missing.length > 0 && <DictReview answer={text} refText={article} />}
        </div>
      )}
      <div className="mt-3 flex justify-end gap-2">
        {!graded ? <Button size="sm" onClick={() => setGraded(true)}>批改</Button> : <Button size="sm" onClick={finish}>完成本遍</Button>}
      </div>
    </div>
  );
}

/** 英语精读 5 遍递进默写：①看英写中（中文按关键词覆盖，宽松）②看中写英 ③④⑤直接默写英文（按词严格）。留 5 遍对比 */
function ReadingDictation({ articleEn, articleCn, attempts, onSave, accent }: { articleEn: string; articleCn: string; attempts: ArtAtt[]; onSave: (a: ArtAtt) => void; accent: string }) {
  const [text, setText] = useState("");
  const [graded, setGraded] = useState(false);
  const [view, setView] = useState<number | null>(null);
  const hasCn = !!articleCn.trim();
  const pass = attempts.length; // 0=第1遍
  const mode: "en2cn" | "cn2en" | "blind" = !hasCn ? "blind" : pass === 0 ? "en2cn" : pass === 1 ? "cn2en" : "blind";
  const ref = mode === "en2cn" ? articleCn : articleEn; // 回顾时对照的原文

  const enTok = (s: string) => (s.toLowerCase().match(/[a-z']+/g) ?? []);
  const cnTok = (s: string) => (s.match(/[一-鿿]/g) ?? []);
  let score = 0;
  let missing: string[] = [];
  if (mode === "en2cn") {
    const exp = new Set(cnTok(articleCn));
    const got = new Set(cnTok(text));
    const hit = [...exp].filter((c) => got.has(c)).length;
    score = exp.size ? Math.round((hit / exp.size) * 100) : 0;
  } else {
    const exp = new Set(enTok(articleEn));
    const got = new Set(enTok(text));
    missing = [...exp].filter((w) => !got.has(w));
    score = exp.size ? Math.round(((exp.size - missing.length) / exp.size) * 100) : 0;
  }

  function finish() {
    onSave({ score, mode, text, ref });
    setText(""); setGraded(false); setView(null);
  }
  const label = (m?: string) => (m === "en2cn" ? "译中" : m === "cn2en" ? "写英" : "默写");
  const tabs = (
    <div className="mb-2 flex flex-wrap items-center gap-1.5">
      {attempts.map((a, i) => (
        <button key={i} onClick={() => setView(i)} className="rounded-full border px-2.5 py-0.5 text-xs" style={view === i ? { background: accent, borderColor: accent, color: "#fff" } : undefined}>
          第{i + 1}遍·{label(a.mode)} {a.score}%
        </button>
      ))}
      {(
        <button onClick={() => setView(null)} className="rounded-full border px-2.5 py-0.5 text-xs" style={view === null ? { background: accent, borderColor: accent, color: "#fff" } : undefined}>
          ✏️ 第{attempts.length + 1}遍
        </button>
      )}
    </div>
  );
  if (view !== null && attempts[view]) {
    const a = attempts[view];
    const aRef = a.ref ?? (a.mode === "en2cn" ? articleCn : articleEn);
    return (
      <div className="mt-3 rounded-lg border p-3" style={{ borderColor: accent + "55" }}>
        {tabs}
        <p className="text-sm">第 {view + 1} 遍（{label(a.mode)}）命中 <b>{a.score}%</b></p>
        {a.text != null && <DictReview answer={a.text} refText={aRef} refLabel={a.mode === "en2cn" ? "中文原意" : "英文原文"} />}
      </div>
    );
  }
  const prompt = mode === "en2cn" ? "① 看英文，写中文翻译（意思到了就行）" : mode === "cn2en" ? "② 看中文，写出英文" : "凭记忆默写英文（什么都不看）";
  return (
    <div className="mt-3 rounded-lg border p-3" style={{ borderColor: accent + "55" }}>
      {tabs}
      <p className="mb-2 text-sm font-medium">{prompt}</p>
      {mode === "en2cn" && <p className="mb-2 whitespace-pre-wrap rounded-md border p-2.5 text-sm leading-relaxed" style={{ background: accent + "10", borderColor: accent + "33" }}>{articleEn}</p>}
      {mode === "cn2en" && <p className="mb-2 whitespace-pre-wrap rounded-md border p-2.5 text-sm leading-relaxed text-muted-foreground" style={{ background: accent + "10", borderColor: accent + "33" }}>{articleCn}</p>}
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={mode === "en2cn" ? "写中文翻译……" : "写英文……"} className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-1 focus:ring-primary/40" />
      {graded && (
        <div className="mt-2 text-sm">
          <p className="mb-1">命中 <b>{score}%</b>{mode === "en2cn" && <span className="text-muted-foreground">（中文按关键词覆盖，意思到了就算过）</span>}</p>
          <DictReview answer={text} refText={ref} refLabel={mode === "en2cn" ? "中文原意" : "英文原文"} />
        </div>
      )}
      <div className="mt-3 flex justify-end gap-2">
        {!graded ? <Button size="sm" onClick={() => setGraded(true)}>批改</Button> : <Button size="sm" onClick={finish}>完成本遍</Button>}
      </div>
    </div>
  );
}

/** 英语精读卡：左文章（可展开整段中文 + 默写），右竖排单词本（可默写） */
function ReadingCard({ entry, accent, onPatch, onDelete }: { entry: Entry; accent: string; onPatch: (id: string, patch: Record<string, unknown>) => void; onDelete: (id: string) => void }) {
  const m = parseMetaObj(entry);
  const articleEn = (m.article_en as string) || entry.body || "";
  const articleCn = (m.article_cn as string) || "";
  const words = (m.words as Word[]) || [];
  const notes = (m.notes as string) || "";
  const recite = (m.recite as string) || "";
  const wordAtt = (m.wordAtt as WordAtt[]) || [];
  const artAtt = (m.artAtt as ArtAtt[]) || [];
  const done = entryDone(entry); // 精读＝默写过（文章或单词）才算看完
  const [showCn, setShowCn] = useState(false);
  const [mode, setMode] = useState<"none" | "word" | "article">("none");

  return (
    <div className={cn("group rounded-lg border bg-background p-3", done && "opacity-70")}>
      <div className="mb-2 flex items-center gap-2">
        {entry.kind && <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: accent + "22", color: accent }}>{entry.kind}</span>}
        {entry.title && <span className="text-sm font-medium">{entry.title}</span>}
        <div className="ml-auto flex items-center gap-2">
          <span
            className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs", done ? "bg-emerald-500 text-white" : "border text-muted-foreground")}
            title="默写过≥1遍（文章或单词）才算看完"
          >
            {done ? "✓ 已默写" : "默写后算看完"}
          </span>
          <button className="invisible text-muted-foreground hover:text-destructive group-hover:visible" title="删除" onClick={() => onDelete(entry.id)}>
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_190px]">
        <div className="min-w-0">
          {/* 默写文章时把原文/学习点/背诵句都高糊，杜绝偷看 */}
          <Blurred active={mode === "article"}>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{articleEn}</p>
            {notes && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">📝 {notes}</p>}
            {recite && <p className="mt-1.5 text-sm" style={{ color: accent }}>🔖 背这句：{recite}</p>}
          </Blurred>
          {mode === "article" && (
            <p className="mt-2 text-xs text-muted-foreground">✍️ 默写中，原文已模糊——写完点「批改」再看。（点「收起默写」可退出）</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {articleCn && (
              <button onClick={() => setShowCn((v) => !v)} className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent">
                {showCn ? "▴ 收起中文" : "▾ 展开中文翻译"}
              </button>
            )}
            <button onClick={() => setMode(mode === "article" ? "none" : "article")} className="rounded-md px-2.5 py-1 text-xs text-primary-foreground" style={{ background: accent }}>
              {mode === "article" ? "收起默写" : `默写文章${artAtt.length ? ` (${artAtt.length}/5)` : ""}`}
            </button>
          </div>
          {showCn && articleCn && (
            <Blurred active={mode === "article"}>
              <p className="mt-2 whitespace-pre-wrap rounded-md border p-2.5 text-sm leading-relaxed text-muted-foreground" style={{ background: accent + "10", borderColor: accent + "33" }}>{articleCn}</p>
            </Blurred>
          )}
        </div>

        <WordBook
          words={words}
          wordAtt={wordAtt}
          mode={mode}
          onSetMode={setMode}
          onWords={(w) => onPatch(entry.id, { words: w })}
          accent={accent}
        />
      </div>

      {mode === "word" && (
        <WordDictation words={words} attempts={wordAtt} accent={accent} onSave={(a) => onPatch(entry.id, { wordAtt: [...wordAtt, a].slice(-3) })} />
      )}
      {mode === "article" && (
        <ReadingDictation articleEn={articleEn} articleCn={articleCn} attempts={artAtt} accent={accent} onSave={(a) => onPatch(entry.id, { artAtt: [...artAtt, a].slice(-5) })} />
      )}
    </div>
  );
}

/** 英语板块：精读卡（ReadingCard）+ 其它（谚语等用 EntryDoc）；按日期折叠，今天展开 */
function EnglishBoard({ cfg, entries, onPatch, onDelete }: { cfg: BoardCfg; entries: Entry[]; onPatch: (id: string, patch: Record<string, unknown>) => void; onDelete: (id: string) => void }) {
  return (
    <DateGroupedBoard
      entries={entries}
      cfg={cfg}
      emptyText="还没有内容。晚上发我「英语学完了，换新的」，我更新进来。"
      renderItem={(e) =>
        e.kind === "精读文章" ? (
          <ReadingCard key={e.id} entry={e} accent={cfg.c.accent} onPatch={onPatch} onDelete={onDelete} />
        ) : (
          <EntryDoc key={e.id} entry={e} accent={cfg.c.accent} onDelete={onDelete} onPatch={onPatch} />
        )
      }
    />
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

/** 复习板块：第二天先默写「前一天」背的——昨天的古诗 + 英语精读，复用各自的默写 */
function ReviewBoard({ entries, onPatch, onDelete }: { entries: Entry[]; onPatch: (id: string, patch: Record<string, unknown>) => void; onDelete: (id: string) => void }) {
  const yest = addDays(todayStr(), -1);
  const acc = (k: Board) => BOARDS.find((b) => b.key === k)!.c.accent;
  const items = entries.filter(
    (e) =>
      e.entry_date === yest &&
      ((e.board === "chinese" && e.kind === "古诗") || (e.board === "english" && e.kind === "精读文章")),
  );
  if (items.length === 0) {
    return (
      <p className="py-10 text-sm text-muted-foreground">
        昨天（{yest}）没有要复习的古诗/精读。今天在语文里背的古诗、英语里学的精读，明天会自动出现在这里让你先默写。
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">先默写昨天（{yest}）背的，再看答案对比。下面各板块的「今天」才是新一天的内容。</p>
      {items.map((e) =>
        e.board === "english" ? (
          <ReadingCard key={e.id} entry={e} accent={acc("english")} onPatch={onPatch} onDelete={onDelete} />
        ) : (
          <EntryDoc key={e.id} entry={e} accent={acc("chinese")} onDelete={onDelete} onPatch={onPatch} />
        ),
      )}
    </div>
  );
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

  const cfg = board ? (board === "review" ? REVIEW_CFG : BOARDS.find((b) => b.key === board)!) : null;
  const rvToday = todayStr();
  const rvYest = addDays(rvToday, -1);
  const reviewCount = all.filter(
    (e) =>
      e.entry_date === rvYest &&
      ((e.board === "chinese" && e.kind === "古诗") || (e.board === "english" && e.kind === "精读文章")),
  ).length;

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
            <ArrowLeft className="size-4" /> 日日学
          </button>
        )}
        <h1 className="text-2xl font-semibold" style={{ color: cfg?.c.text }}>
          {cfg ? cfg.name : "日日学"}
        </h1>
        {cfg && <span className="text-sm text-muted-foreground">{cfg.hint}</span>}
        {!board && (
          <button
            onClick={() => setBoard("review")}
            className="ml-auto flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors"
            style={{ borderColor: REVIEW_CFG.c.accent, color: REVIEW_CFG.c.text, background: REVIEW_CFG.c.bg }}
            title="先默写昨天背的古诗 / 英语精读"
          >
            <RotateCcw className="size-4" /> 复习{reviewCount > 0 ? ` (${reviewCount})` : ""}
          </button>
        )}
      </div>

      {!board && <Landing entries={all} onOpen={setBoard} />}

      {board === "review" && (
        <ReviewBoard entries={all} onPatch={patchEntry} onDelete={del} />
      )}

      {board === "english" && cfg && (
        <EnglishBoard cfg={cfg} entries={boardEntries.filter((e) => e.kind !== "note")} onPatch={patchEntry} onDelete={del} />
      )}

      {board && cfg && (board === "chinese" || board === "ai" || board === "history" || board === "finance" || board === "pm") && (
        <LearningBoard cfg={cfg} entries={boardEntries.filter((e) => e.kind !== "note")} onAdd={addLearning} onDelete={del} onPatch={patchEntry} />
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
    name: "日日学",
    icon: BookOpen,
    description: "英语/语文/AI/历史/书籍/电影 六大板块",
    defaultSize: { w: 1, h: 1 },
  },
  Card,
  Page,
};

export default studyLogModule;
