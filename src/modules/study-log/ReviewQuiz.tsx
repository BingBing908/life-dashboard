import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 「看提示答一个答案」型复习（recall 模式），目前用于成语。
 *
 * ⚠️ **方向是反的，这是刻意的**：出题给「意思」，让她答「成语」。
 * 因为她学成语的目的是「治说话没文化」——真实使用场景是
 * *想表达某个意思时能不能调出那个成语*，所以检索方向必须是 意思 → 成语。
 * 反过来（看成语说意思）只练认得出，练不出用得出。
 *
 * 判对＝去掉标点空格后完全一致（成语是固定四字格，不该给模糊空间）。
 * 答错不惩罚，显示答案让她照着重打一遍，打对才算过——跟 ReviewDictation 的
 * 「订正到全对」是同一套逻辑。
 */
export function ReviewQuiz({
  prompt,
  answer,
  hint,
  passed,
  accent,
  onPass,
}: {
  /** 题面（成语的意思） */
  prompt: string;
  /** 正确答案（成语本身） */
  answer: string;
  /** 可选的辅助提示，如出处 */
  hint?: string;
  passed: boolean;
  accent: string;
  onPass: (stats: { wrong: number; rounds: number }) => void;
}) {
  const [text, setText] = useState("");
  const [tries, setTries] = useState(0);
  const [wrongFirst, setWrongFirst] = useState<number | null>(null);
  const [reveal, setReveal] = useState(false);
  const [done, setDone] = useState(passed);

  const norm = (s: string) => s.replace(/[\s，。,.、；;！!？?“”"'‘’（）()·]/g, "").trim();

  function submit() {
    const ok = norm(text) === norm(answer);
    const t = tries + 1;
    setTries(t);
    if (wrongFirst === null && !ok) setWrongFirst(1);
    if (ok) {
      // 第一次就答对＝wrong 0；答错过再打对＝wrong 1（成语只有一个答案，非 0 即 1）
      setDone(true);
      onPass({ wrong: wrongFirst === null ? 0 : 1, rounds: t });
      return;
    }
    setReveal(true);
  }

  function redo() {
    setText("");
    setTries(0);
    setWrongFirst(null);
    setReveal(false);
    setDone(false);
  }

  if (done) {
    return (
      <div className="mt-2 rounded-lg border p-3" style={{ borderColor: "#10b98155", background: "#10b98110" }}>
        <p className="text-sm font-medium text-emerald-700">
          ✓ 复习通过——答案是「{answer}」
        </p>
        <button onClick={redo} className="mt-2 rounded-md border px-2.5 py-1 text-xs hover:bg-accent">
          再答一遍
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border p-3" style={{ borderColor: accent + "55" }}>
      <p className="mb-1 text-xs text-muted-foreground">看意思，想出是哪个成语</p>
      <p
        className="mb-2 whitespace-pre-wrap rounded-md border p-2.5 text-sm leading-relaxed"
        style={{ background: accent + "10", borderColor: accent + "33" }}
      >
        {prompt}
      </p>
      {hint && <p className="mb-2 text-xs text-muted-foreground">出处：{hint}</p>}
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setReveal(false);
        }}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="打出这个成语……"
        className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40"
      />
      {reveal && (
        <div className="mt-1.5 text-sm">
          <span className="text-red-600">不是这个。</span>
          <span className="ml-1 text-muted-foreground">
            答案是「<b className="text-foreground">{answer}</b>」——照着打一遍就算过。
          </span>
        </div>
      )}
      <div className="mt-2 flex items-center gap-2">
        {tries > 0 && !reveal && (
          <span className="text-xs text-muted-foreground">第 {tries + 1} 次尝试</span>
        )}
        <Button size="sm" className={cn("ml-auto")} onClick={submit}>
          {reveal ? "确认" : "对答案"}
        </Button>
      </div>
    </div>
  );
}
