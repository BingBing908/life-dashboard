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
  passed,
  accent,
  onPass,
}: {
  /** 题面（成语的意思，答案已被 recallCard 换成 ____） */
  prompt: string;
  /** 正确答案（成语本身） */
  answer: string;
  passed: boolean;
  accent: string;
  onPass: (stats: { wrong: number; rounds: number }) => void;
}) {
  const [text, setText] = useState("");
  const [tries, setTries] = useState(0);
  const [wrongFirst, setWrongFirst] = useState<number | null>(null);
  const [reveal, setReveal] = useState(false);
  const [done, setDone] = useState(passed);

  /**
   * ⚠️ **大小写要忽略**（2026-10-26 加）：成语是纯中文、全等判没问题，但 PM/FDE 的答案里
   * 有 `MVP`、`Prompt 缓存`、`RICE` 这类英文，她打小写就会被判错——这跟「音标混进答案
   * 导致十个词全判错」是同一类伤害：**答对了却被说错**，比答错本身打击人得多。
   */
  const norm = (s: string) =>
    s.replace(/[\s，。,.、；;！!？?“”"'‘’（）()·]/g, "").trim().toLowerCase();

  function submit() {
    /**
     * 判对＝全等 **或** 一方包含另一方且长度相差不大（短的 ≥ 长的 60%）。
     *
     * ⚠️ **为什么要放宽**：成语的答案是四字固定词，全等很公平；但概念名有通用的长短写法
     * ——「北极星指标」答成「北极星」、「按价值定价」答成「价值定价」，意思完全正确却会被
     * 判错。60% 这道阈值挡得住蒙混（「指标」只占「北极星指标」的 40%，不算过），
     * 又放得过真答对的人。
     * ⚠️ 长度 ≥2 才启用包含判定，否则单个字（「图」）会命中一大堆答案。
     */
    const a = norm(text);
    const b = norm(answer);
    const near =
      a.length >= 2 &&
      b.length >= 2 &&
      (a.includes(b) || b.includes(a)) &&
      Math.min(a.length, b.length) / Math.max(a.length, b.length) >= 0.6;
    const ok = a === b || near;
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
