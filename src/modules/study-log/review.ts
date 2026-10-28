import { addDays, daysBetween, todayStr } from "@/lib/dates";
import type { Entry } from "./data";

/**
 * 间隔复习排程（纯函数，无副作用，便于别处复用/测试）。
 *
 * 旧版复习板块只拉「昨天」的内容 —— 过了一天就再也不出现，学过的实际上在漏。
 * 现在改成艾宾浩斯式间隔：学完后第 1/3/7/15/30 天各复习一次，五次全默到全对＝毕业。
 *
 * 进度存在 `meta.revs`（历次通过日期数组，升序）。旧数据只有单个 `meta.reviewedAt`，
 * 读的时候当作 `[reviewedAt]` 兼容；写的时候两个都写，老版本页面也不至于读空。
 */

/**
 * 一条内容一共复习 5 次。
 *
 * ⚠️⚠️ **锚点是「上一次实际复习那天」，不是固定的学完日**（2026-07-29 Rosie 拍板，
 * 原话：「艾宾浩斯遗忘曲线这个要灵活一点呀，应该是按我第一次复习默写算第一天，
 * 而不是固定日期，不然我逾期复习就一直放在这吗」）。
 *
 * 原来算 `entry_date + [1,3,7,15,30]`，问题是**逾期会一直挂着**：7 月 21 日学的诗，
 * 第一次该 22 日复习，她 29 日才打开——按固定日期，第 2 次早在 24 日就"到期"了，
 * 于是她刚默完一遍，这条立刻又逾期 5 天卡在列表里，永远还不完。而且间隔的意义也没了：
 * 22 日和 24 日之间隔 2 天才是记忆曲线要的，7 月 29 日连着做两轮等于白做。
 *
 * 现在改成**每次复习都重置时钟**：`REVIEW_GAPS[n]` ＝ 第 n 次复习距上一次的天数。
 * 从 [1,3,7,15,30] 的**差值**来，所以对按时复习的人排出的日期跟原来一模一样，
 * 只有拖延时才不同——拖了就顺延，不倒扣。
 */
export const REVIEW_GAPS = [1, 2, 4, 8, 15];

/**
 * 会进复习队列的内容类型。
 *
 * ⚠️ **加类型前先算稳态负担**：间隔是 5 段，所以
 * 「每天到期条数 ＝ 5 × 每天新进队列的条数」。每天进 2 条 → 稳态每天要复习 10 条。
 * 所以贵的（全文默写 5–9 分钟）要克制，便宜的（一句/一个词，20 秒）可以多加。
 * 历史/练笔/AI 新闻/书影/金融**刻意不进**：故事和输出型内容没有「精确记住」这回事。
 *
 * `mode` 决定用哪种复习形式：
 * · `dictation` → 整篇默写 + 逐句订正（ReviewDictation）
 * · `recall`    → 看提示答一个答案（ReviewQuiz），用于成语这种「要能调得出来」的
 */
export type ReviewMode = "dictation" | "recall";

export interface ReviewKind {
  board: string;
  kind: string;
  label: string;
  mode: ReviewMode;
  /** recall 型从 body 的哪一节抽题面（默认「意思」＝成语那套）。PM 概念用「一句话定义」 */
  promptSection?: string;
  /**
   * 这类内容是**哪天才进的复习队列**（YYYY-MM-DD）。只影响**逾期天数**的起算点
   * （`overdueDays` 从到期日和它里面取晚的那个算起），不影响到不到期。
   *
   * ⚠️ **没有它的话，给一个已经存在三个月的板块开复习，存量条目会在开通当天
   * 一起顶着「晚了 96 天」——而那个数字是假的**：她从来没被要求复习过它们，
   * 是我今天才把这一类加进队列的。拿系统自己的改动去指责用户，跟「音标混进答案
   * 导致十个词全判红叉」是同一类伤害：**明明没做错却被说做错了**。
   * 开通当天它们照样到期（该复习就是该复习），只是不倒扣历史。
   *
   * ⚠️ 加新类型时**记得一起加它**，填加进队列的那天。存量条目越多越要紧。
   */
  since?: string;
}

export const REVIEW_KINDS: ReviewKind[] = [
  { board: "chinese", kind: "古诗", label: "古诗", mode: "dictation" },
  { board: "english", kind: "精读文章", label: "英语精读", mode: "dictation" },
  // 2026-07-28 加：谚语短、复习成本约 20 秒，性价比最高
  { board: "english", kind: "谚语", label: "英语谚语", mode: "dictation" },
  // 2026-07-28 加：成语用 recall（看意思答成语），约 25 秒
  { board: "chinese", kind: "成语", label: "成语", mode: "recall" },
  /**
   * 2026-10-26 加：PM 概念进队列（她点头的）。
   *
   * **为什么非加不可**：她 10/26 说「把产品经理 921 的四个看了，可是好像没在我脑子里留下什么」——
   * 根因是 PM 板块原本**刻意不进复习**（旧注释说"由每日产品拆解承担"，但拆解本身也是读物、
   * 没承担起来），于是 PM 内容读一遍再也不见，隔 35 天当然不记得。而她被诊断出的短板恰恰是
   * **「会做但叫不出名字」**——词汇和框架不复习必忘，且这正是面试现场要当场调出来的东西。
   *
   * **成本算过**（按「加复习类型前先算稳态负担」那条规矩）：间隔 5 段 ⇒ 稳态每天到期
   * ＝ 5 × 每天新进 1 条 ＝ 5 条，每条约 25 秒 ⇒ **约 2 分钟/天**，比古诗便宜得多。
   *
   * ⚠️ **方向必须是反向**（同成语）：给场景/定义 → 答概念名。面试考的是「遇到这事能不能
   * 想起有个框架叫 RICE」，正向（看 RICE 答定义）只练认得出、练不出用得出。
   * ⚠️ 题面取 **【一句话定义】** 节 ⇒ **注入 PM 概念时必须写这一节**，没有就抽不出题面、
   * 这条不进队列（`isReviewable` 对 recall 型要求能抽出题面，宁可漏也别排没题目的题）。
   */
  { board: "pm", kind: "PM概念", label: "PM 概念", mode: "recall", promptSection: "一句话定义", since: "2026-10-26" },
  /**
   * 2026-10-26 同批加：FDE 技术知识点（她：「AI FDE 我刚好还没看，你要不按照这个逻辑也改下」）。
   * 跟 PM 概念同性质——都是**术语/原理**，都属于她那句「会做但叫不出名字」，
   * 也都是面试现场要当场调出来的，所以同样 recall 反向出题、同样取【一句话定义】。
   *
   * ⚠️ **FDE 的另外三类刻意不进队列**，理由各不相同：
   * · **架构图**——复习形式应该是「合上页面自己重画一遍」，现有两种 mode（默写/recall）
   *   都表达不了画图，硬塞成 recall 只会变成背名词。所以放在条目里当读后自测，不进队列。
   * · **实战案例**——偏理解和迁移，复习形式是「换个场景再套一遍」，同产品拆解。
   * · **面试题**——它本身就是题，再进队列等于一题两记；而且 PM/FDE 两边的面试题一起进会爆量。
   */
  { board: "fde", kind: "技术知识点", label: "FDE 技术点", mode: "recall", promptSection: "一句话定义", since: "2026-10-26" },
  /**
   * 2026-10-28 加：AI 术语卡。**这是她那句「记不住 AI 的知识点」的直接原因**——
   * 查过库：AI 板块 66 条里新闻+速览+趋势占 54 条（82%，按设计就是读完即过期的），
   * 真正该记的术语卡只有 12 张，而这 12 张**从 7 月到 10 月一次都没进过复习队列**。
   * 她读得最多的那部分本来就不该记，该记的那部分一次都没复习过。
   *
   * ⚠️ 同 PM/FDE：反向出题（给定义答术语名），题面取 **【一句话定义】**，
   * 答案用 `meta.recallAnswer` 显式给 ⇒ **注入术语卡时这两样都是必填**，少一样就进不了队列。
   */
  { board: "ai", kind: "术语卡", label: "AI 术语", mode: "recall", promptSection: "一句话定义", since: "2026-10-28" },
];

export function reviewKindOf(e: Entry): ReviewKind | null {
  return REVIEW_KINDS.find((k) => k.board === e.board && k.kind === e.kind) ?? null;
}

/** 会进复习队列吗（没有 entry_date 的排不了程；recall 型还要能抽出题面，
 *  否则会排出一道没有题目的题——宁可不排） */
export function isReviewable(e: Entry): boolean {
  if (!e.entry_date) return false;
  const k = reviewKindOf(e);
  if (!k) return false;
  if (k.mode === "recall") return !!recallCard(e);
  return true;
}

function metaObj(e: Entry): Record<string, unknown> {
  try {
    return e.meta ? JSON.parse(e.meta) : {};
  } catch {
    return {};
  }
}

/**
 * 一次复习通过的记录。
 * `wrong`/`rounds` 是 2026-07-28 加的「难度」信息——只有日期答不了
 * 「我是真记牢了还是每次都在重新背」这个问题（Rosie 的用户故事原话）。
 * 老数据里 `revs` 是纯日期字符串、更老的只有单个 `reviewedAt`，读的时候统一归一成这个形状。
 */
export interface RevRecord {
  /** 通过那天 */
  d: string;
  /** 第一遍整篇默写错了几句（0＝一遍过）；老记录没有，为 undefined */
  wrong?: number;
  /** 一共默了几轮才全对（1＝一次过）；老记录没有 */
  rounds?: number;
  /**
   * 这一次**没过**（第一遍答错、看了答案重学之后才答对）。
   *
   * ⚠️⚠️ 2026-10-28 加，起因是她说「你给我那些术语复习题我全错，更可怕的是我复习了之后
   * 仍然毫无印象」。查她 10/27 的记录：8 条错 7 条，而且**全部 `rounds=2`**——
   * 也就是「答错 → 系统直接显示答案 → 照着打一遍 → 判通过 → 和答对的卡片用同样的间隔升级」。
   * 三个错误叠在一起：①答错和答对待遇一样（间隔按 stage 写死，`wrong` 只记录不影响排程）
   * ②「照着答案打一遍」是抄写不是提取，几乎不产生记忆 ③于是系统在假装她学会了。
   * **答错的卡必须回到最短间隔重来**（Anki 的 Again 就是干这个的），这就是这个字段的用处：
   * `reviewStage` 见到 fail 就把级数清零 ⇒ 明天还会出现。
   */
  fail?: boolean;
}

/** 历次复习记录（升序、按日期去重）。兼容纯字符串数组和旧的 reviewedAt 单值 */
export function reviewLog(e: Entry): RevRecord[] {
  const m = metaObj(e);
  const raw: unknown[] = Array.isArray(m.revs)
    ? (m.revs as unknown[])
    : typeof m.reviewedAt === "string" && m.reviewedAt
      ? [m.reviewedAt]
      : [];
  const byDate = new Map<string, RevRecord>();
  for (const r of raw) {
    if (typeof r === "string" && r) {
      if (!byDate.has(r)) byDate.set(r, { d: r });
    } else if (r && typeof r === "object" && typeof (r as RevRecord).d === "string") {
      const rec = r as RevRecord;
      // 同一天重复出现时，保留带难度信息的那条
      const prev = byDate.get(rec.d);
      if (!prev || prev.wrong === undefined) byDate.set(rec.d, rec);
    }
  }
  return [...byDate.values()].sort((a, b) => a.d.localeCompare(b.d));
}

/** 历次复习通过的日期（升序、去重）——排程只关心日期 */
export function reviewDates(e: Entry): string[] {
  return reviewLog(e).map((r) => r.d);
}

/**
 * 已连续通过几次（0 ＝ 还没复习过，**或上一次答错被打回了**）。
 * 答错一次就从头来过——见 `RevRecord.fail` 的注释。
 */
export function reviewStage(e: Entry): number {
  let n = 0;
  for (const r of reviewLog(e)) n = r.fail ? 0 : n + 1;
  return n;
}

/** 五次全走完＝记牢了，不再进队列 */
export function isGraduated(e: Entry): boolean {
  return reviewStage(e) >= REVIEW_GAPS.length;
}

/**
 * 排程的锚点：复习过就是**最后一次复习那天**，没复习过就是学完那天。见 REVIEW_GAPS 的注释。
 *
 * ⚠️ **还没复习过、且这类内容是后来才进队列的，锚点取「进队列那天」**（见 `ReviewKind.since`）。
 * 否则 10/26 给 PM 开复习，7 月学的第 1 课会立刻顶着「晚了 96 天」——她从没被要求
 * 复习过它，那个数字纯属系统倒打一耙。
 */
function anchorOf(e: Entry): string | null {
  const log = reviewDates(e);
  if (log.length) return log[log.length - 1];
  if (!e.entry_date) return null;
  const since = reviewKindOf(e)?.since;
  return since && since > e.entry_date ? since : e.entry_date;
}

/** 下一次该复习的日期；已毕业/无日期返回 null */
export function nextDue(e: Entry): string | null {
  if (!e.entry_date || isGraduated(e)) return null;
  const anchor = anchorOf(e);
  return anchor ? addDays(anchor, REVIEW_GAPS[reviewStage(e)]) : null;
}

/**
 * 今天该不该复习：到期（含逾期）且今天还没默到全对。
 * 「今天已通过」的排除保证一条内容一天最多推进一级 —— 长期没打开时不会一天里把
 * 1/3/7/15/30 五轮全怼到脸上，而是每天补一轮慢慢追上。
 */
export function isDueToday(e: Entry, today = todayStr()): boolean {
  if (!isReviewable(e)) return false;
  if (reviewDates(e).includes(today)) return false;
  const due = nextDue(e);
  return !!due && due <= today;
}

/**
 * 逾期天数（0 ＝ 正好今天到期）。
 *
 * ⚠️⚠️ **「不倒扣历史」这件事必须在 `anchorOf` 里做，不能在这里做**（2026-10-27 的教训）。
 * 10-26 我图省事只在这里把天数夹住，结果同一行里出现了
 * 「**晚了 1 天（本该 9月22日 周二）**」——数字被我改了，日期还是从老锚点算的，
 * 9/22 到 10/27 明明隔了 35 天。Rosie 一眼看出来，原话「你这时间是没有往下走吗」。
 * **凡是同一个事实有多个展示口（天数 / 日期 / 曲线 / 预告），就只能改它们共同的上游**，
 * 在某一个出口上打补丁必然跟别的出口打架。
 */
export function overdueDays(e: Entry, today = todayStr()): number {
  const due = nextDue(e);
  if (!due) return 0;
  return Math.max(0, daysBetween(due, today));
}

/** 从 body 里抽古诗的【原诗】段（body 常含【注释】【白话】等大段，不能拿整段当答案） */
function poemBody(e: Entry): string {
  const m = (e.body ?? "").match(/【原诗】([\s\S]*?)(?=\n*【|$)/);
  return m ? m[1].trim() : "";
}

const lines = (s: string): string[] =>
  s.split("\n").map((x) => x.trim()).filter(Boolean);

/**
 * 拆掉古诗的「题头」（标题行 + 作者行），只留诗句。
 *
 * ⚠️ **2026-07-29 修的真 bug**：Rosie 把《塞下曲》正文一字不差地默对了，却被判错——
 * 因为 `meta.recite` 里连标题和作者一起存着（「塞下曲 · 其三　卢纶〔唐〕」），
 * 她写成「塞下曲其三 唐卢纶」，格式不同就算错。**标题和作者不该是默写内容**，
 * 它们是「要默哪一首」的提示。
 *
 * 判据：诗句一定含中文标点（，。！？；），题头行不含。从头往下扫，
 * 连续不含标点的短行都算题头，遇到第一行带标点的就开始算正文。
 */
function splitPoem(text: string): { head: string; body: string } {
  const ls = lines(text);
  const head: string[] = [];
  let i = 0;
  while (i < ls.length && !/[，。！？；]/.test(ls[i]) && ls[i].length <= 24) {
    head.push(ls[i]);
    i++;
  }
  // 万一整段都不含标点（异常数据），别把正文吃光——那就当没有题头
  if (i >= ls.length) return { head: "", body: ls.join("\n") };
  return { head: head.join(" · "), body: ls.slice(i).join("\n") };
}

/** 正文第一行非空文本（英语谚语的英文句就在第一行） */
function firstLine(e: Entry): string {
  return lines(e.body ?? "")[0] ?? "";
}

/**
 * 复习时给的**提示**——不用默，只用来认出「这是哪一条」。
 *
 * ⚠️ 没有提示是不行的（2026-07-29 Rosie 反馈）：英语谚语只给一个空框，
 * 她根本想不起来该默哪句；精读文章同理。提示的原则是
 * **给足够认出来的信息，但不能把答案给出去**：
 * · 古诗 → 标题 + 作者（诗句才是要默的）
 * · 英语谚语 → 中文释义（英文句才是要默的）
 * · 英语精读 → 整段中文翻译（英文才是要默的）
 */
export function reviewHint(e: Entry): string {
  const m = metaObj(e);
  if (e.kind === "古诗") {
    const src = (typeof m.recite === "string" && m.recite.trim()) || poemBody(e) || e.body || "";
    return splitPoem(src).head;
  }
  if (e.kind === "谚语") {
    // body 第一行是英文句，第二行是中文释义
    return lines(e.body ?? "")[1] ?? "";
  }
  if (e.kind === "精读文章") {
    return typeof m.article_cn === "string" ? m.article_cn : "";
  }
  return "";
}

/** 提示该怎么显示（古诗的题头是一行，精读的中文是一大段，样式不一样） */
export function hintLabel(e: Entry): string {
  if (e.kind === "古诗") return "默这一首";
  if (e.kind === "谚语") return "这句中文是";
  if (e.kind === "精读文章") return "中文对照（照它默英文）";
  return "提示";
}

/**
 * 这一轮该默什么。
 *
 * ⚠️ **精读第 3 轮起降级**（2026-07-28）：精读全文默写一次要 8–9 分钟，占稳态复习
 * 时间的大头（约 70%）。所以第 1、2 次默全文，第 3、4、5 次只默背诵句
 * （`meta.recite`，没有就退回全文首句）。精读的稳态成本因此从约 45 分钟降到约 20 分钟，
 * 腾出来的空间才装得下谚语和成语。
 *
 * @param stage 已通过次数（0 ＝ 这是第 1 次复习）
 */
export function reviewTarget(e: Entry, stage = 0): string {
  const m = metaObj(e);
  const recite = typeof m.recite === "string" ? m.recite.trim() : "";

  if (e.kind === "精读文章") {
    const full = (typeof m.article_en === "string" ? m.article_en : "") || e.body || "";
    if (stage < 2) return full;
    return recite || full.split(/(?<=[.!?])\s+/)[0] || full;
  }
  if (e.kind === "谚语") return recite || firstLine(e);
  // 古诗：⚠️ 必须剥掉题头（标题/作者），它们是提示不是答案——见 splitPoem 的注释
  const poemSrc = recite || poemBody(e) || e.body || "";
  return splitPoem(poemSrc).body || poemSrc;
}

/** 这一轮默的是「只背诵句」而不是全文——UI 要说清楚，否则她会以为文章被弄丢了 */
export function isShortRound(e: Entry, stage = 0): boolean {
  return e.kind === "精读文章" && stage >= 2;
}

/** 从 body 抽某个【小节】的内容（成语的 body 是【读音】【意思】【出处】【例句】这种分节格式） */
function section(e: Entry, name: string): string {
  const m = (e.body ?? "").match(new RegExp(`【${name}】([\\s\\S]*?)(?=\\n*【|$)`));
  return m ? m[1].trim() : "";
}

/**
 * recall 模式的题目：题面＝意思，答案＝成语本身。
 * 成语的标题格式是「成语 · 一鼓作气」，所以答案取 `·` 之后那截；
 * 万一哪天标题不带前缀，就整个标题当答案。
 * ⚠️ 抽不出意思（body 没有【意思】节）就返回 null——宁可不排这条，
 * 也别给一道没有题面的题。
 *
 * ⚠️⚠️ **题面必须抹掉答案**（2026-07-29 Rosie：「成语别写出处，又把原文露出来了」）。
 * 泄题有**两处**，只堵出处是不够的：
 * ①【出处】几乎必然含成语本身（「读《易》，韦编三绝。」）——直接不给，出处不是复习必需的。
 * ②【意思】**也含**！中文释义的惯用写法就是「……后用『韦编三绝』形容读书勤奋」，
 *   答案明晃晃写在题面里。所以题面里出现答案的地方一律换成 ____。
 * 这不是内容写错了——释义带上词条是正常辞书体，注入侧不用改，读的时候遮掉就行。
 */
export function recallCard(e: Entry): { prompt: string; answer: string } | null {
  /**
   * 答案优先取 **`meta.recallAnswer`**（显式指定），没有才从标题推。
   *
   * ⚠️⚠️ **PM/FDE 必须显式给**（2026-10-26 查实）：她的 PM 条目标题是「第 N 课 · 概念A + 概念B」
   * ——一课讲两个概念，从标题推只会得到「MVP 最小可行产品 + 怎么砍需求」「北极星指标 + 看懂
   * DAU/留存/转化」这种没法作答的东西。成语标题（「成语 · 纲举目张」）才是干净的一对一。
   * 这跟 `meta.exercise` 立起来时定的是同一条原则：**判据要显式，别拿标题/板块去猜**。
   *
   * 从标题推时仍砍掉副标题（`——`/`：`/`（` 之后），那是给成语和将来格式规整的条目兜底的。
   */
  const m = metaObj(e);
  const explicit = typeof m.recallAnswer === "string" ? (m.recallAnswer as string).trim() : "";
  const answer =
    explicit ||
    ((e.title ?? "")
      .split("·")
      .pop()
      ?.split(/——|—|：|:|（|\(/)[0]
      .trim() ??
      "");
  const raw = section(e, reviewKindOf(e)?.promptSection ?? "意思");
  if (!answer || !raw) return null;
  // 连引号一起吃掉，否则会留下一对空引号「」把字数漏出去
  const prompt = raw
    .replace(new RegExp(`[「『“"]?${escapeRe(answer)}[」』”"]?`, "g"), "____")
    .trim();
  if (!prompt) return null;
  return { prompt, answer };
}

/** 成语里可能有正则元字符（虽然罕见），转义一下再拼进 RegExp */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 今天要复习的，学得早的排前面（也就是逾期最久的先还） */
export function dueEntries(entries: Entry[], today = todayStr()): Entry[] {
  return entries
    .filter((e) => isDueToday(e, today))
    .sort((a, b) => (a.entry_date ?? "").localeCompare(b.entry_date ?? ""));
}

/** 未来还排着的复习：{ 日期: 条数 }，只看今天之后 */
export function upcomingByDate(
  entries: Entry[],
  today = todayStr(),
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    if (!isReviewable(e) || isGraduated(e)) continue;
    const due = nextDue(e);
    if (due && due > today) out[due] = (out[due] ?? 0) + 1;
  }
  return out;
}

/**
 * 记一次通过，返回给 patchEntry 的 meta 补丁（同一天重复调用是空补丁）。
 * `stats` 是这次默写的难度（第一遍错几句 / 默了几轮），没传就只记日期。
 * 同时写 `reviewedAt`＝最后一次通过日，让还没更新的老版本页面也读得到。
 */
export function passPatch(
  e: Entry,
  today = todayStr(),
  stats?: { wrong: number; rounds: number; fail?: boolean },
): Record<string, unknown> {
  const log = reviewLog(e);
  if (log.some((r) => r.d === today)) return {};
  const rec: RevRecord = stats
    ? { d: today, wrong: stats.wrong, rounds: stats.rounds, ...(stats.fail ? { fail: true } : {}) }
    : { d: today };
  return { revs: [...log, rec].sort((a, b) => a.d.localeCompare(b.d)), reviewedAt: today };
}

/** 这条内容的复习「完整曲线」：五个间隔各自的状态，供 ReviewTrack 画 */
export type StepState = "passed" | "due" | "upcoming";
export interface ReviewStep {
  /** 第几次（1..5） */
  n: number;
  /** 距上一次复习几天（＝REVIEW_GAPS[n-1]；原来是"学完后第几天"，改成相对后这个才准） */
  gap: number;
  state: StepState;
  /** 计划日期（未通过的）或实际通过日期（已通过的） */
  date: string | null;
  rec?: RevRecord;
}

export function reviewSteps(e: Entry, today = todayStr()): ReviewStep[] {
  /**
   * ⚠️ **答错被打回的那几次不占格子**（2026-10-28）：曲线画的是「现在连着过了几次」，
   * 跟 `reviewStage` 必须是同一个数。不切掉的话，一次失败会在曲线上显示成「已通过」，
   * 而级数已经清零——又变成「同一个事实两个出口对不上」那类 bug（见 overdueDays 的注释）。
   * 排程锚点仍然取**最后一次作答那天**（含答错那次），那是 `anchorOf` 的事，这里不碰。
   */
  const all = reviewLog(e);
  const lastFail = all.map((r) => !!r.fail).lastIndexOf(true);
  const log = lastFail < 0 ? all : all.slice(lastFail + 1);
  const out: ReviewStep[] = [];
  // 未来几格的计划日期要**顺着锚点往后推**，不能各自从 entry_date 算——
  // 否则她拖了几天，后面几格全成了"已经逾期"（就是 Rosie 说的"一直放在这"）。
  let cursor = anchorOf(e);
  for (let idx = 0; idx < REVIEW_GAPS.length; idx++) {
    const gap = REVIEW_GAPS[idx];
    const rec = log[idx];
    if (rec) {
      out.push({ n: idx + 1, gap, state: "passed", date: rec.d, rec });
      continue;
    }
    cursor = cursor ? addDays(cursor, gap) : null;
    // 只有「下一个该做的」那一格算 due，后面的都是 upcoming
    const state: StepState = idx === log.length && cursor && cursor <= today ? "due" : "upcoming";
    out.push({ n: idx + 1, gap, state, date: cursor });
  }
  return out;
}
