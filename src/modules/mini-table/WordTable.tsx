import { useEffect, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getKnownWords, listAllEntries, setWordKnown } from "../study-log/data";
import type { MiniTable } from "./data";

/**
 * 单词表（2026-08-21 Rosie 要的）：
 * 「只显示单词，点击后显示中文释义，双击标熟（但不消失只是颜色变浅一点）」。
 *
 * ⚠️ **为什么不复用 `ListTable`**：那边是「几列并排的清单」，列有含义（谚语/成语/古诗）。
 * 单词没有列的概念，是一片**散铺的词**，几十上百个——铺成自动换行的网格才看得全，
 * 塞进固定列里等于人为切成几段。所以单独一个渲染器。
 *
 * ⚠️ **词是全局去重的**（按小写）：同一个词可能出现在多篇精读里，认识了就是认识了，
 * 不该在另一篇里又算一次生词。这跟单词级 SRS 的调度单位一致（那边也是按词不按篇）。
 * 释义取第一次出现的那个；出自哪几篇在弹窗里列出来。
 *
 * ⚠️⚠️ **单击/双击共存不用防抖定时器**：DOM 里双击会先发两次 click 再发 dblclick，
 * 而这里的 click 是**切换释义**——切两次正好回到原状态，所以双击的净效果就是只标熟、
 * 释义不动。**别好心加 setTimeout 去"修"它**，那只会让单击变迟滞。
 */
export function WordTable({ table, onBack }: { table: MiniTable; onBack: () => void }) {
  const [words, setWords] = useState<{ en: string; cn: string; from: string[] }[] | null>(null);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null); // 展开释义的那个词（小写）

  useEffect(() => {
    (async () => {
      const [all, k] = await Promise.all([listAllEntries(), getKnownWords()]);
      setKnown(k);
      // 按 entry_date 升序扫，先出现的先排——跟她学的顺序一致
      const arts = all
        .filter((e) => e.board === "english" && e.kind === "精读文章")
        .sort((a, b) => ((a.entry_date ?? "") < (b.entry_date ?? "") ? -1 : 1));
      const map = new Map<string, { en: string; cn: string; from: string[] }>();
      for (const e of arts) {
        let ws: { en?: string; cn?: string }[] = [];
        try {
          ws = (JSON.parse(e.meta ?? "{}").words as { en?: string; cn?: string }[]) ?? [];
        } catch {
          ws = [];
        }
        const label = (e.title ?? "").replace(/^Day\s*/i, "Day ");
        for (const w of ws) {
          const en = (w.en ?? "").trim();
          if (!en) continue;
          const lc = en.toLowerCase();
          const hit = map.get(lc);
          if (hit) {
            if (!hit.from.includes(label)) hit.from.push(label);
          } else {
            map.set(lc, { en, cn: (w.cn ?? "").trim(), from: [label] });
          }
        }
      }
      setWords([...map.values()]);
    })().catch(() => setWords([]));
  }, [table.id]);

  async function toggleKnown(en: string) {
    const lc = en.toLowerCase();
    const next = !known.has(lc);
    setKnown((s) => {
      const n = new Set(s);
      if (next) n.add(lc);
      else n.delete(lc);
      return n;
    });
    await setWordKnown(en, next);
  }

  const knownCount = words ? words.filter((w) => known.has(w.en.toLowerCase())).length : 0;
  const cur = words?.find((w) => w.en.toLowerCase() === open);

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-3 flex shrink-0 items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">{table.name}</h1>
          <p className="text-xs text-muted-foreground">
            共 {words?.length ?? "…"} 个词
            {words && ` · 已标熟 ${knownCount} 个 · 还剩 ${words.length - knownCount} 个`}
          </p>
        </div>
      </div>
      <p className="mb-3 shrink-0 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        <b>单击</b>看中文释义，<b>双击</b>标熟／取消标熟。标熟的词<b>不会消失</b>，只是颜色变浅——
        它还留在表里，方便你回头确认。词来自各篇精读的生词本，全局去重、实时更新。
      </p>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border p-3">
        {words === null && <p className="py-10 text-center text-sm text-muted-foreground">读取中…</p>}
        {words !== null && words.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            还没有生词。日日学的英语精读更新后这里会自动出现。
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {(words ?? []).map((w) => {
            const isKnown = known.has(w.en.toLowerCase());
            const isOpen = open === w.en.toLowerCase();
            return (
              <button
                key={w.en}
                onClick={() => setOpen(isOpen ? null : w.en.toLowerCase())}
                onDoubleClick={() => toggleKnown(w.en)}
                title={isKnown ? "已标熟（双击取消）" : "单击看释义 · 双击标熟"}
                className={cn(
                  "select-none rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  isKnown
                    ? "border-dashed bg-transparent text-muted-foreground/50"
                    : "bg-card hover:bg-accent/50",
                  isOpen && "border-primary ring-1 ring-primary/40",
                )}
              >
                {w.en}
              </button>
            );
          })}
        </div>
      </div>

      {/* 释义弹窗。用弹窗而不是就地展开，是为了不让网格里的词一展开就整片位移 */}
      {cur && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
          onClick={() => setOpen(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border bg-card p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-start gap-3">
              <div className="min-w-0">
                <h2 className="break-words text-xl font-semibold">{cur.en}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  出自 {cur.from.join("、")}
                  {known.has(cur.en.toLowerCase()) && " · 已标熟"}
                </p>
              </div>
              <button
                onClick={() => setOpen(null)}
                className="ml-auto shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent"
                title="关闭"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="text-base">{cur.cn || <span className="text-muted-foreground">（这条没写中文释义）</span>}</p>
            <div className="mt-4 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => toggleKnown(cur.en)}>
                {known.has(cur.en.toLowerCase()) ? "取消标熟" : "标记为已会"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
