import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { todayStr } from "@/lib/dates";
import type { Entry } from "./data";
import { dueWords, wordStats, type WordCard } from "./wordReview";

/**
 * 单词到期队列（一次一个词，看中文写英文）。
 *
 * ⚠️ **方向是 中→英**，刻意的：她的短板是中级词汇的**产出**（能读懂但写不出、说不出）。
 * 看英文认中文只练识别，中译英才练产出。单个英文词打起来约 4 秒，
 * 所以哪怕稳态每天几十个词，也只是几分钟的事。
 *
 * 判对＝去掉非字母数字后小写全等（大小写、标点、多余空格都不计），
 * 但拼写必须对——词汇复习放宽拼写就没意义了。
 * 答错显示答案照着打一遍才算过，跟其它复习形式一致。
 */

const norm = (s: string) => (s || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

export function WordReview({
  entries,
  onPass,
}: {
  entries: Entry[];
  /** 通过一个词：交给页面写回该条目的 meta.wordSrs */
  onPass: (card: WordCard, stats: { wrong: number; rounds: number }) => void;
}) {
  const today = todayStr();
  const stats = useMemo(() => wordStats(entries, today), [entries, today]);
  // 队列在打开时定格：做题过程中 entries 会因为回写而变化，
  // 若跟着重算，当前这个词会从队列里消失、直接跳到下一个，体验很跳。
  const [queue] = useState<WordCard[]>(() => dueWords(entries, today));
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [tries, setTries] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [doneCount, setDoneCount] = useState(0);

  const card = queue[idx];

  function next() {
    setText("");
    setTries(0);
    setReveal(false);
    setIdx((i) => i + 1);
  }

  function submit() {
    if (!card) return;
    const ok = norm(text) === norm(card.en);
    const t = tries + 1;
    setTries(t);
    if (!ok) {
      setReveal(true);
      return;
    }
    onPass(card, { wrong: t === 1 ? 0 : 1, rounds: t });
    setDoneCount((n) => n + 1);
    next();
  }

  if (stats.total === 0) return null;

  return (
    <div className="mb-4 rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-sm font-medium">单词复习</h3>
        <span className="text-xs text-muted-foreground">
          今天到期 <b className="text-foreground">{queue.length}</b> 个 · 词库 {stats.total} 个 · 已记牢{" "}
          {stats.graduated}
        </span>
        {queue.length > 0 && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="ml-auto text-xs text-primary hover:underline"
          >
            {open ? "先不背" : "开始背"}
          </button>
        )}
      </div>

      {queue.length === 0 && (
        <p className="mt-1 text-xs text-muted-foreground">今天没有到期的单词 🎉</p>
      )}

      {open && queue.length > 0 && (
        <div className="mt-3">
          {card ? (
            <>
              <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  第 {idx + 1}/{queue.length} 个
                </span>
                <span>· 第 {card.stage + 1}/5 次</span>
                {card.overdue > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                    逾期 {card.overdue} 天
                  </span>
                )}
                {card.entryTitle && <span className="truncate">· 出自 {card.entryTitle}</span>}
              </div>
              <p className="mb-2 rounded-md border bg-muted/40 px-3 py-2.5 text-base">{card.cn || "（这个词没写中文释义）"}</p>
              <input
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setReveal(false);
                }}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="写出对应的英文……"
                autoFocus
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40"
              />
              {reveal && (
                <p className="mt-1.5 text-sm">
                  <span className="text-red-600">不对。</span>
                  <span className="ml-1 text-muted-foreground">
                    是「<b className="text-foreground">{card.en}</b>」——照着打一遍就算过。
                  </span>
                </p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={next}
                  className="text-xs text-muted-foreground hover:text-foreground"
                  title="跳过不算通过，明天还会来"
                >
                  跳过
                </button>
                <Button size="sm" className={cn("ml-auto")} onClick={submit}>
                  {reveal ? "确认" : "对答案"}
                </Button>
              </div>
            </>
          ) : (
            <p className="py-3 text-sm font-medium text-emerald-700">
              这批背完了 🎉 通过 {doneCount} 个{doneCount < queue.length && `，跳过 ${queue.length - doneCount} 个（明天还会来）`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
