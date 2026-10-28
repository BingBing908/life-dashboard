import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * 「看提示答一个答案」型复习（recall 模式）：成语 / PM 概念 / FDE 技术点 / AI 术语。
 *
 * ⚠️ **方向是反的，这是刻意的**：出题给「意思 / 一句话定义」，让她答「名字」。
 * 因为真实场景是*想表达某个意思、或遇到某种情况时，能不能调出那个词*——
 * 面试考的是「遇到这事能不能想起有个框架叫 RICE」。反过来（看名字说定义）
 * 只练认得出，练不出用得出。
 *
 * ⚠️⚠️ **答错之后的流程是整个组件的重点**（2026-10-28 重写）。
 * 老版本是：答错 → 直接显示答案 → 文案写着「照着打一遍就算过」→ 打对 → 判通过 →
 * 和答对的卡片用完全一样的间隔升级。查她 10/27 的记录，8 条错 7 条、**全部 rounds=2**，
 * 她的原话是「我复习了之后仍然毫无印象」——**这是系统设计造成的，不是她的问题**：
 * 「照着答案打一遍」是抄写不是提取，几乎不产生记忆；而答错照常升级等于系统在假装她学会了。
 *
 * 现在改成她 2026-10-28 拍板的那档：
 * ① 答错 → 给出答案 + **把定义补完整让她重读**（题面里被遮掉的 ____ 填回去）
 * ② 「待会儿再考我」→ `onMiss()` 让调用方把这张卡**挪到本轮队列末尾**，做完别的题再回来答
 * ③ 末尾答对才算完成，但**记一次 fail** ⇒ `reviewStage` 清零 ⇒ **明天还会出现**
 *
 * 判对规则（忽略大小写 + 允许近似）见 `submit()` 里的注释。
 */
export function ReviewQuiz({
  prompt,
  answer,
  passed,
  accent,
  onPass,
  onMiss,
}: {
  /** 题面（成语的意思 / 概念的一句话定义，答案已被 recallCard 换成 ____） */
  prompt: string;
  /** 正确答案（成语本身 / 概念名） */
  answer: string;
  passed: boolean;
  accent: string;
  onPass: (stats: { wrong: number; rounds: number; fail?: boolean }) => void;
  /**
   * 答错、读完答案之后调用——调用方据此把这张卡挪到本轮列表末尾。
   * 不传也能用（就退化成「原地重答」），但那样就没有"隔几道题再提取"的效果了。
   */
  onMiss?: () => void;
}) {
  const [text, setText] = useState("");
  const [tries, setTries] = useState(0);
  /** 这一轮里有没有答错过——决定最后记不记 fail */
  const [missed, setMissed] = useState(false);
  /** 正在「重学」：显示答案和完整定义，等她点「待会儿再考我」 */
  const [relearn, setRelearn] = useState(false);
  const [done, setDone] = useState(passed);

  /**
   * ⚠️ **大小写要忽略**（2026-10-26 加）：成语是纯中文、全等判没问题，但 PM/FDE/AI 的答案里
   * 有 `MVP`、`Prompt 缓存`、`RICE` 这类英文，她打小写就会被判错——这跟「音标混进答案
   * 导致十个词全判错」是同一类伤害：**答对了却被说错**，比答错本身打击人得多。
   */
  const norm = (s: string) =>
    s.replace(/[\s，。,.、；;！!？?“”"'‘’（）()·]/g, "").trim().toLowerCase();

  /** 把题面里被遮掉的 ____ 填回答案——答错后让她重读一遍完整的定义 */
  const fullPrompt = prompt.replace(/_{2,}/g, answer);

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
    if (ok) {
      setDone(true);
      // 这一轮错过 ⇒ 记 fail：级数清零、明天还会出现（见 RevRecord.fail）
      onPass({ wrong: missed ? 1 : 0, rounds: t, ...(missed ? { fail: true } : {}) });
      return;
    }
    setRelearn(true);
  }

  /** 读完答案，挪到队列末尾等会儿再考 */
  function laterAgain() {
    setMissed(true);
    setRelearn(false);
    setText("");
    onMiss?.();
  }

  function redo() {
    setText("");
    setTries(0);
    setMissed(false);
    setRelearn(false);
    setDone(false);
  }

  if (done) {
    return (
      <div className="mt-2 rounded-lg border p-3" style={{ borderColor: "#10b98155", background: "#10b98110" }}>
        <p className="text-sm font-medium text-emerald-700">
          {missed ? "✓ 这次答上来了" : "✓ 复习通过"}——答案是「{answer}」
        </p>
        {missed && (
          <p className="mt-1 text-xs text-muted-foreground">
            刚才答错过，所以这条<b>不算记牢</b>：级数回到起点，明天还会再出现一次。
          </p>
        )}
        <button onClick={redo} className="mt-2 rounded-md border px-2.5 py-1 text-xs hover:bg-accent">
          再答一遍
        </button>
      </div>
    );
  }

  /* 重学：给答案 + 补完整的定义让她重读，不给输入框——这一步**刻意不让她照抄**，
     抄一遍不产生记忆，所以答案和输入框不同时出现。 */
  if (relearn) {
    return (
      <div className="mt-2 rounded-lg border p-3" style={{ borderColor: "#f59e0b55", background: "#f59e0b10" }}>
        <p className="text-sm">
          <span className="text-amber-700">不是这个。</span>
          <span className="ml-1">
            答案是「<b>{answer}</b>」
          </span>
        </p>
        <p
          className="mt-2 whitespace-pre-wrap rounded-md border p-2.5 text-sm leading-relaxed"
          style={{ background: accent + "10", borderColor: accent + "33" }}
        >
          {fullPrompt}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          读一遍再往下。这条今天<b>不算过</b>——等会儿在列表最下面还会再考你一次，明天也还会出现。
        </p>
        <Button size="sm" className="mt-2" onClick={laterAgain}>
          读完了，待会儿再考我
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border p-3" style={{ borderColor: accent + "55" }}>
      <p className="mb-1 text-xs text-muted-foreground">
        {missed ? "刚才这条没答上来，再想一次（别翻上去看）" : "读题面，想出是哪一个"}
      </p>
      <p
        className="mb-2 whitespace-pre-wrap rounded-md border p-2.5 text-sm leading-relaxed"
        style={{ background: accent + "10", borderColor: accent + "33" }}
      >
        {prompt}
      </p>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="打出名字……"
        className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40"
      />
      <div className="mt-2 flex items-center gap-2">
        {tries > 0 && <span className="text-xs text-muted-foreground">第 {tries + 1} 次尝试</span>}
        <Button size="sm" className="ml-auto" onClick={submit}>
          对答案
        </Button>
      </div>
    </div>
  );
}
