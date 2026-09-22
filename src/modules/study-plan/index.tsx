import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarCheck, ExternalLink, Play, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DoneToggle, type PlanState } from "@/components/DoneToggle";
import { Fireworks } from "@/components/Fireworks";
import { QuickAdd } from "@/components/QuickAdd";
import { Input } from "@/components/ui/input";
import { EditableText } from "@/components/EditableText";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CARD, CARD_TITLE, PAGE } from "@/lib/ui";
import { seedUuid } from "@/lib/db";
import { addDays, formatDateCn, mondayOf, todayStr } from "@/lib/dates";
import { useSubPath } from "@/lib/hashRoute";
import { openLink } from "@/lib/openLink";
import type { AppModule } from "../types";
import {
  applyPeriod,
  createItem,
  CYCLE_PHASES,
  cycleWeekOf,
  dayNumOf,
  editItemFrom,
  getCycleStart,
  getPeriodOn,
  getSeedVersion,
  latestSeedVersion,
  listAllItems,
  listChecks,
  listCheckStatus,
  listItems,
  listNotes,
  matchesDay,
  resetToSeed,
  seedIfEmpty,
  setCheckStatus,
  setNote,
  toggleCheck,
  TRACKS,
  retireOrDeleteItem,
  updateItemUrl,
  type CheckStatus,
  type PlanItem,
  type Track,
} from "./data";
import { createTodo, isStaleStudyTodo, listTodos, toggleTodo, type Todo } from "../todo/data";
// 三餐互通（2026-09-20）：全天轴上的三餐卡显示饮食模块填的内容，只读——填写去饮食页
import { getMeals } from "../supplement/data";
import { SEED_ITEMS, SEMESTER_PLAN, SEMESTER_TARGET } from "./seed";
import { RoadmapStages } from "./RoadmapStages";
import { Collapse } from "@/components/Collapse";

/** 所有种子条目的确定性 id 集合（与 seedIfEmpty 的生成方式完全一致）。
 *  ⚠️ 用 id 判定「是否原定计划」，不用名字——名字会被经期开关换成 period_title、也会被就地改名，
 *  按名字判定会误伤（Rosie 踩过：经期版腰椎稳定被当成计划外给删了）；id 建库起就固定，最稳。 */
const SEED_IDS = new Set(
  SEED_ITEMS.map((s) => seedUuid(`plan_item:${s.track}|${s.title}|${s.time_slot}`)),
);

/** 种子的「内容指纹」，用来兜住**改过 key 的老行**：id 是播种那天按
 *  `track|title|time_slot` 算死的，后来把某条的 track/标题/时段一改，key 就变了，
 *  早先播下的那行 id 仍是老值、不在 SEED_IDS 里，于是被当成「计划外」给出删除按钮。
 *  2026-07-28 踩到：足弓重建 2026-07-20 播种（那时 key 与现在不同），成了可删的孤儿行。 */
const SEED_KEYS = new Set(
  SEED_ITEMS.map((s) => `${s.track}|${s.title}|${s.time_slot}`),
);

/** 是否原定计划条目——是则不允许删除，只有自己加的「计划外」（随机 id）才能删。
 *  先看 id（最稳：经期开关换名、就地改名都不影响它；Rosie 踩过按名字判定误删经期版腰椎稳定），
 *  id 认不出再退回内容指纹。两条都不中才算计划外。
 *  ⚠️ 不能反过来只留指纹——经期 swap 会把 title 换成 period_title，那时只有 id 认得出来。
 *  「计划外」是 addExtra 建的、没有 time_slot，指纹永远配不上带时段的种子，不会被误锁。 */
function isSeedItem(item: PlanItem): boolean {
  return (
    SEED_IDS.has(item.id) ||
    SEED_KEYS.has(`${item.track}|${item.title}|${item.time_slot}`)
  );
}

/** 四个视图 tab，进 hash 子路径（当前＝无子段，见 lib/hashRoute.ts 的约定）。
 *  **当前 / 今天 分工**（2026-07-28 Rosie 定）：
 *  「当前」＝此刻该干什么——竖线时间轴自动跟随时间 + 当前领域按状态分栏，进来就动手；
 *  「今天」＝全天一览——紧凑清单，一条一行、13 条一屏，用来扫和补勾（不放笔记框和详解）。
 *  ⚠️ 别让「今天」也去做整天时间轴，那就跟「当前」职责重了。 */
/** ⚠️ 2026-09-20 Rosie：时间轴只留「当前」＝一日简览——今天/一周与日程重合、路线搬去了日程页。
 *  tab 按钮已从页面移除；这三个视图的代码分支和 URL（#/study-plan/today|week|roadmap）暂时保留，
 *  等用稳了再做删除大扫除（一次删干净涉及 ItemRow/weekChecks/Roadmap 引用一大串，别顺手删一半）。 */
const PLAN_TABS = ["current", "today", "week", "roadmap"] as const;
type PlanTab = (typeof PLAN_TABS)[number];

/** 今天视图（此刻时间轴）的领域：养生→英语→工作→学习→运动→阅读，按一天时间早晚排 */
interface Domain {
  key: string;
  name: string;
  start: number; // 当天分钟数，用于按当前时间自动定位到该做的事
  time: string;
  color: string;
  tint: string;
  textc: string;
  source: "plan" | "todo";
  tracks?: Track[];
  noteRequired: boolean;
  timeMin?: number; // 只收该时间(分钟)及以后的条目
  timeMax?: number; // 只收该时间之前的条目
  weekdaysOnly?: boolean; // 只在工作日(周一~五)出现，周末隐藏（如「工作」域）
  timeLabel?: string; // source==="todo" 的域（工作）没有 plan_items，轴上的时段只能写死在这里
}

/**
 * 时间轴的「域」＝一天里的大块（养生/英语/工作/日日学/学习/运动/阅读/睡前）。
 *
 * ⚠️⚠️ **2026-09-22 按 Rosie 的真实作息重切（她原话：学习 13:00–19:45 那一大段不对，
 * 应该拆成 13:00–14:00 日日学、14:05–17:45 工作、18:30–19:45 学习）**。
 * 之前只有一个 `study` 域收全部 ai 条目，于是 min–max 把「日日学 13:00」和「学习 19:45」
 * 算成一整段、把下午上班时间整个吞了；下午的工作也没有自己的轴节点（work 域只有上午一个 start）。
 *
 * 切法＝**同一个 track 按时间窗口分成几个域**（`timeMin`/`timeMax`），这样工作日和周末
 * 用同一套定义各自成立，不用为周末另写一份：
 *   ai「日日学」13:00–14:00（周1-6）      → daily
 *   ai「学习」09:45–12:00（周6,7）        → studyAM
 *   ai「学习」14:05–17:30（周6）          → studyPM
 *   ai「学习」18:30–19:45（周2,4,5）、周日的复盘/排课表 → study
 * ⚠️ **今天没有条目的 plan 域不进轴**（见 `domains` 的 filter）——否则工作日会冒出
 * 两个空的「学习」占位，跟上午的工作撞在一起。
 * ⚠️ 工作域是 `source: "todo"`（内容来自待办、没有 plan_items），所以时段只能写死在
 * `timeLabel` 里——**改上班时间要同时改这里和骨架 frame 那两条「工作」**，别只改一处。
 */
const DOMAINS: Domain[] = [
  // 养生只收上午的（泡脚/睡前拉伸这类晚间养生归到最后的「睡前」节点）
  { key: "wellness", name: "养生", start: 370, time: "6:10", color: "#A6CBF1", tint: "#F3F8FE", textc: "#185FA5", source: "plan", tracks: ["wellness"], noteRequired: false, timeMax: 720 },
  // 2026-09-01 新作息：07:30 先吃早餐、英语 07:55 才开始（三条合并成一条整块）
  { key: "english", name: "英语", start: 475, time: "7:55", color: "#5E9AE0", tint: "#EFF6FD", textc: "#0C447C", source: "plan", tracks: ["english"], noteRequired: true },
  { key: "work", name: "工作", start: 615, time: "10:15", timeLabel: "10:15–12:00", color: "#85B7EB", tint: "#F0F6FD", textc: "#185FA5", source: "todo", noteRequired: false, weekdaysOnly: true },
  // 周末上午的学习（09:45–12:00，周六日）——工作日这一段是上班，域为空自动隐藏
  { key: "studyAM", name: "学习", start: 585, time: "9:45", color: "#2E7CD6", tint: "#E6F1FB", textc: "#042C53", source: "plan", tracks: ["cert", "ai"], noteRequired: true, timeMin: 540, timeMax: 780 },
  // 日日学 13:00–14:00（周1-6，午休后那一小时）
  { key: "daily", name: "日日学", start: 780, time: "13:00", color: "#5E9AE0", tint: "#EFF6FD", textc: "#0C447C", source: "plan", tracks: ["ai"], noteRequired: true, timeMin: 780, timeMax: 840 },
  // 下午上班（14:05–17:20，晚餐 17:25–17:45 是骨架卡，自己一行）
  { key: "work2", name: "工作", start: 845, time: "14:05", timeLabel: "14:05–17:20", color: "#85B7EB", tint: "#F0F6FD", textc: "#185FA5", source: "todo", noteRequired: false, weekdaysOnly: true },
  // 周六下午的学习（14:05–17:30）——工作日为空自动隐藏
  { key: "studyPM", name: "学习", start: 845, time: "14:05", color: "#2E7CD6", tint: "#E6F1FB", textc: "#042C53", source: "plan", tracks: ["cert", "ai"], noteRequired: true, timeMin: 840, timeMax: 1080 },
  // 晚间学习 18:30–19:45（周2,4,5；周日是复盘/排课表）
  // ⚠️ `tracks` 里保留 "cert"：华为认证只是**暂停**（种子条目已移除），想恢复时
  // 把 seed.ts 那两条加回来就能直接归位，不用再动这里。
  { key: "study", name: "学习", start: 1110, time: "18:30", color: "#2E7CD6", tint: "#E6F1FB", textc: "#042C53", source: "plan", tracks: ["cert", "ai"], noteRequired: true, timeMin: 1080 },
  { key: "sport", name: "运动", start: 1190, time: "19:50", color: "#6FA7E4", tint: "#EFF6FD", textc: "#0C447C", source: "plan", tracks: ["sport"], noteRequired: false },
  { key: "reading", name: "阅读", start: 1260, time: "21:00", color: "#85B7EB", tint: "#F0F6FD", textc: "#185FA5", source: "plan", tracks: ["reading"], noteRequired: true },
  // 睡前：晚间养生（泡脚 21:00、睡前拉伸 21:40），按时间收 18:00 之后的 wellness 条目
  { key: "bedtime", name: "睡前", start: 1300, time: "21:40", color: "#A6CBF1", tint: "#F3F8FE", textc: "#185FA5", source: "plan", tracks: ["wellness"], noteRequired: false, timeMin: 1080 },
];

function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/** 从 time_slot（如 "21:00–21:40"）解析开始分钟数 */
function slotStartMin(item: PlanItem): number {
  const m = (item.time_slot ?? "").match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

/** 某领域今天该做的计划条目（含时段过滤：养生只收上午、睡前只收 18:00 之后）。
 *  抽出来是因为「当前」的大卡片、左侧进度条、「今天」的紧凑清单三处都要用同一套判断，
 *  以前只写在 planCards 里，另两处一复制就会走偏。 */
function domainItems(d: Domain, list: PlanItem[]): PlanItem[] {
  if (d.source !== "plan" || !d.tracks) return [];
  return list.filter((i) => {
    if (!d.tracks!.includes(i.track)) return false;
    const s = slotStartMin(i);
    if (d.timeMax !== undefined && s >= d.timeMax) return false;
    if (d.timeMin !== undefined && s < d.timeMin) return false;
    return true;
  });
}

/** 轴节点的时段标签（2026-09-20 Rosie：只显示开始时间不清晰）：按今天该域条目的
 *  实际时间算 min–max。周末学习域会跨午休（09:40–18:00），min–max 是粗颗粒，但仍比
 *  单个开始时间信息多；没有带时段条目时回退 d.time。改条目时间后这里自动跟着变。 */
/** 某域今天的结束时刻（分钟）——红线定位要用：一行还没结束时，红线该画在它**上面**。
 *  plan 域取今天各条目的最晚结束；todo 域（工作）没有条目，从写死的 timeLabel 里解析。 */
function domainEndMin(d: Domain, list: PlanItem[]): number {
  let to = -1;
  for (const it of domainItems(d, list)) to = Math.max(to, slotEndMin(it));
  if (to > 0) return to;
  const m = (d.timeLabel ?? "").match(/[–—-]s*(d{1,2}):(d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : d.start;
}

function domainTimeLabel(d: Domain, list: PlanItem[]): string {
  let from = Infinity;
  let to = -1;
  for (const it of domainItems(d, list)) {
    const m = (it.time_slot ?? "").match(/(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/);
    if (!m) continue;
    from = Math.min(from, Number(m[1]) * 60 + Number(m[2]));
    to = Math.max(to, Number(m[3]) * 60 + Number(m[4]));
  }
  if (to < 0) return d.timeLabel ?? d.time;
  const f = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
  return `${f(from)}–${f(to)}`;
}

/** 多行就地编辑（详解用；EditableText 是单行的）。键位同日程编辑区：Enter 保存、
 *  Ctrl+Enter 换行、Esc 取消。允许存空（清掉说明后显示占位）。 */
function EditableParagraph({
  value,
  onSave,
  placeholder,
  className,
  inputClassName,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder: string;
  /** 传了就整体替换默认样式（标题复用这个组件时用） */
  className?: string;
  inputClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const commit = () => {
    if (draft.trim() !== value.trim()) onSave(draft.trim());
    setEditing(false);
  };
  if (editing) {
    return (
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (e.ctrlKey) {
              const el = e.currentTarget;
              const s = el.selectionStart;
              setDraft(draft.slice(0, s) + "\n" + draft.slice(el.selectionEnd));
              requestAnimationFrame(() => {
                el.selectionStart = el.selectionEnd = s + 1;
              });
            } else {
              commit();
            }
          }
        }}
        rows={Math.max(2, draft.split("\n").length)}
        className={
          inputClassName ??
          "mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm leading-relaxed outline-none ring-1 ring-primary/30"
        }
      />
    );
  }
  return (
    <p
      role="button"
      tabIndex={0}
      title="点击修改（Enter 保存 · Ctrl+Enter 换行）"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className={className ?? "mt-2 cursor-text text-sm leading-relaxed whitespace-pre-line text-muted-foreground"}
    >
      {value || <span className="opacity-60">{placeholder}</span>}
    </p>
  );
}

/** 细进度条（左侧时间轴每站挂一条，把「完成了多少/一共多少」画在轴上） */
function MiniBar({ done, total, color }: { done: number; total: number; color: string }) {
  return (
    <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-muted">
      <span
        className="block h-full rounded-full transition-all"
        style={{ width: total > 0 ? `${(done / total) * 100}%` : 0, background: color }}
      />
    </span>
  );
}

/**
 * 「今日计划」清空时的反馈（2026-07-28 Rosie 要求）：
 * · 全部做完（未完成栏是空的）→ 放烟花 + 「都处理完了 🎉」
 * · 有标了「未完成」的 → **不放烟花**，给一句鼓励语
 * 语气按她的定位来（复健期学习者，不赶进度、重连续性）：不说教、不假嗨、
 * 承认没做完也是一种决定。随机挑一句，免得每天看同一句变得廉价。
 */
const CHEERS: string[] = [
  "这一段收工了。剩下的挪到明天，不算欠账。",
  "没全做完不算输——你把每一条都过了一遍，这就是在管自己的一天。",
  "能诚实地标「未完成」，比假装它不存在强得多。明天接着来。",
  "做了多少算多少。节奏比数量重要，别跟自己较劲。",
  "复健期不求满分，求不断线。今天也算数。",
  "标完了就别回头看了。今天的账结清，明天是新的。",
  "决定「今天不做」也是决定。留着力气给明天。",
  "又往前挪了一点。慢一点的进度也是进度。",
];

function pickCheer(): string {
  return CHEERS[Math.floor(Math.random() * CHEERS.length)];
}

/* ColHead / DoneStrip 已删（2026-07-29）：按状态分栏那版被换成「单栏 + 换色沉底」，
   已决定的条目不再压缩成窄条，所以这两个组件没有调用方了。历史做法见 git log。 */
/** 「今天」紧凑清单的一行：时间｜标题｜详解截断｜状态键｜视频。刻意不放笔记框和详解全文——
 *  那是「当前」的活儿，这里只求一屏扫完 + 随手补勾。 */
function CompactRow({
  title,
  timeSlot,
  detail,
  url,
  state,
  canCheck,
  onDone,
  onSkip,
  onClear,
}: {
  title: string;
  timeSlot: string | null;
  detail: string | null;
  url: string | null;
  state: PlanState;
  canCheck: boolean;
  onDone: () => void;
  onSkip: () => void;
  onClear: () => void;
}) {
  const done = state === "done";
  const skip = state === "skip";
  return (
    // 已决定的只换底色（完成绿 / 未完成黄），行高不变、内容不压缩——跟「当前」的卡片同一套语言
    <div
      className={cn(
        "grid items-center gap-3 border-b px-3 py-2 last:border-b-0",
        done ? "bg-emerald-50/50" : skip ? "bg-amber-50/50" : "hover:bg-accent/30",
      )}
      style={{ gridTemplateColumns: "94px minmax(0,1fr) minmax(0,1.1fr) auto auto" }}
    >
      <span className="text-[11px] tabular-nums text-muted-foreground">{timeSlot ?? "—"}</span>
      <span className={cn("truncate text-sm", done && "text-muted-foreground line-through decoration-1")}>
        {title}
      </span>
      <span className="truncate text-xs text-muted-foreground">{detail ?? ""}</span>
      <DoneToggle
        state={state}
        canComplete={canCheck}
        disabledHint="先去「当前」写一句「做了什么」才能打勾"
        size="sm"
        onDone={onDone}
        onSkip={onSkip}
        onClear={onClear}
      />
      {url ? (
        <button
          onClick={() => openLink(url)}
          className="shrink-0 rounded-md border px-2 py-1 text-xs text-primary hover:bg-accent"
          title={url}
        >
          视频
        </button>
      ) : (
        <span className="w-[42px]" />
      )}
    </div>
  );
}

/** 当前时间落在哪个领域（最后一个 start<=now；早于第一个则第一个） */
/** 从 time_slot 解析**结束**分钟数（"19:55–20:20" → 1220）；解析不出返回 -1 */
function slotEndMin(item: PlanItem): number {
  const m = (item.time_slot ?? "").match(/[–—-]\s*(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : -1;
}

/**
 * 「当前」视图该停在哪个领域。
 *
 * ⚠️⚠️ **2026-09-01 改成两级判断**，原来只有下面的 ② 那一条（取最后一个 `start ≤ now`）。
 * 单锚点隐含一个前提：**一个领域一天只出现一次、且各领域时段互不交错**。
 * 这个前提在晚间重排后不成立了——学习被拆成 19:00–19:45 和 20:25–21:10 两段、
 * 中间夹着运动(19:55–20:20)。只按 start 排的话，20:25 之后 `now` 仍然大于运动的
 * start，于是**整个学习②时段都会错误地停在「运动」上**（50 分钟）。
 *
 * ① 先看**今天的条目时段**有没有正好套住此刻——这才是真实的「我现在该干什么」；
 * ② 套不住（两段之间的空隙、或工作域压根没有 time_slot）再退回原来的锚点规则。
 */
function autoDomainKey(domains: Domain[], items: PlanItem[], dayNum: number): string {
  const now = nowMinutes();
  const date = todayStr(); // autoDomainKey 只用于今天，单次条目(@日期)按今天匹配
  for (const d of domains) {
    for (const it of domainItems(d, items)) {
      if (!matchesDay(it, dayNum, date)) continue;
      const s = slotStartMin(it);
      const e = slotEndMin(it);
      if (e > s && now >= s && now < e) return d.key;
    }
  }
  /** 没有任何域的时段套住此刻（骨架时间：打扫/护肤/吃饭…）⇒ 挂到**时间上最近**的域
   *  （2026-09-20 Rosie：打扫时不该显示英语，该挂最近的学习）。距离＝now 到该域今天各
   *  条目时段的最短间隔；「接下来要做的」减半权重，平手时偏向 upcoming。 */
  let best: string | null = null;
  let bestDist = Infinity;
  for (const d of domains) {
    for (const it of domainItems(d, items)) {
      if (!matchesDay(it, dayNum, date)) continue;
      const s = slotStartMin(it);
      const e = slotEndMin(it);
      if (!(e > s)) continue;
      const dist = s > now ? (s - now) * 0.5 : now - e;
      if (dist < bestDist) {
        bestDist = dist;
        best = d.key;
      }
    }
  }
  if (best) return best;
  // 兜底（今天一个带时段的条目都没有）：老锚点规则
  let key = domains[0].key;
  for (const d of domains) if (d.start <= now) key = d.key;
  return key;
}

// 2026-09-20 Rosie：「框全换成蓝色系，深浅不一就行，彩色太花哨」——领域/线路彩色退役，
// 蓝一族靠深浅区分：学习最深→养生最浅（与日日学环色、日程三档蓝同族）
const TRACK_STYLE: Record<Track, { bg: string; text: string; dot: string }> = {
  wellness: { bg: "bg-[#F3F8FE]", text: "text-[#185FA5]", dot: "bg-[#A6CBF1]" },
  sport:    { bg: "bg-[#EFF6FD]", text: "text-[#0C447C]", dot: "bg-[#6FA7E4]" },
  english:  { bg: "bg-[#EFF6FD]", text: "text-[#0C447C]", dot: "bg-[#5E9AE0]" },
  cert:     { bg: "bg-[#F0F6FD]", text: "text-[#185FA5]", dot: "bg-[#85B7EB]" },
  ai:       { bg: "bg-[#E6F1FB]", text: "text-[#042C53]", dot: "bg-[#2E7CD6]" },
  reading:  { bg: "bg-[#F0F6FD]", text: "text-[#185FA5]", dot: "bg-[#85B7EB]" },
  // frame＝作息骨架：listItems 已滤掉、时间轴根本渲染不到它，这行只为满足 Record<Track,…> 的类型
  frame:    { bg: "bg-gray-50",    text: "text-gray-500",    dot: "bg-gray-400" },
};

const DAY_NAMES = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function TrackTag({ t }: { t: Track }) {
  const s = TRACK_STYLE[t];
  const name = TRACKS.find((x) => x.key === t)?.name ?? t;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px]", s.bg, s.text)}>
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {name}
    </span>
  );
}


function Card() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [items, checks, cycleStart] = await Promise.all([
        listItems(),
        listChecks(todayStr()),
        getCycleStart(),
      ]);
      if (items.length === 0) {
        setText("点击进入，生成你的第一份周计划。");
        return;
      }
      const dayNum = dayNumOf(todayStr());
      const todays = items.filter((i) => matchesDay(i, dayNum, todayStr()));
      const done = todays.filter((i) => checks.has(i.id)).length;
      const week = cycleStart ? cycleWeekOf(cycleStart, todayStr()) : 1;
      setText(`今日 ${done}/${todays.length} 项 · 周期第 ${week} 周`);
    })().catch(() => setText("点击进入查看。"));
  }, []);

  return <p className="text-sm text-muted-foreground">{text ?? "加载中…"}</p>;
}

function ItemRow({
  item,
  withCheck,
  hideTag = false,
  state,
  noteVal,
  onNote,
  onDone,
  onSkip,
  onClear,
  onRename,
  onDelete,
  noteGate = true,
}: {
  item: PlanItem;
  withCheck: boolean;
  hideTag?: boolean;
  state: PlanState;
  noteVal: string;
  onNote: (v: string) => void;
  onDone: () => void;
  onSkip: () => void;
  onClear: () => void;
  onRename: (v: string) => void;
  onDelete?: () => void; // 仅计划外（自己加的）传；原定计划不给删
  noteGate?: boolean; // 补卡过去的天不门控笔记
}) {
  const done = state === "done";
  const decided = state !== "pending";
  const needsNote =
    item.track === "english" ||
    item.track === "cert" ||
    item.track === "ai" ||
    item.track === "reading";
  const canCheck = !noteGate || !needsNote || done || noteVal.trim().length > 0;
  const showNote = withCheck && needsNote;
  const notePlaceholder =
    item.track === "reading"
      ? "看到哪本书的哪里？如：《她对此感到厌烦》第3章"
      : item.track === "english"
        ? "今天做了什么？如：刷完001"
        : "看了哪个视频 / 做了什么？";
  return (
    <div className={cn("group rounded-lg border px-4 py-3.5", withCheck && decided && "opacity-60")}>
      <div className="flex items-center gap-3.5">
        {withCheck && (
          <DoneToggle
            state={state}
            canComplete={canCheck}
            onDone={onDone}
            onSkip={onSkip}
            onClear={onClear}
            size="sm"
            disabledHint="先写「做了什么」才能标记完成"
          />
        )}
        <span className="w-28 shrink-0 text-sm text-muted-foreground">{item.time_slot}</span>
        {!hideTag && <TrackTag t={item.track} />}
        <div className="min-w-0 flex-1">
          <EditableText
            value={item.title}
            onSave={onRename}
            className={cn("block text-[15px] font-medium", withCheck && done && "line-through")}
            inputClassName="w-full text-[15px]"
          />
          {item.detail && (
            <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground" title={item.detail}>
              {item.detail}
            </p>
          )}
        </div>
        {item.url && (
          <button
            className="flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-primary hover:bg-accent"
            title="打开跟练视频"
            onClick={() => openLink(item.url!)}
          >
            <ExternalLink className="size-4" /> 跟练
          </button>
        )}
        {onDelete && (
          <button
            className="invisible shrink-0 text-muted-foreground hover:text-destructive group-hover:visible"
            title="删除（计划外·自己加的）"
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
      {showNote && (
        <input
          value={noteVal}
          onChange={(e) => onNote(e.target.value)}
          placeholder={done ? "已完成" : notePlaceholder + "（写了才能打勾）"}
          className="mt-2 h-8 w-full rounded-md border bg-background px-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/40"
        />
      )}
    </div>
  );
}

/** 今天视图的大卡片：完成状态 + 明细时间 + 标题 + 打开 / 详解 / 网址 / 我做了什么 */
function ThreeRowCard({
  title,
  timeSlot,
  detail,
  url,
  state,
  noteRequired,
  notePlaceholder,
  noteVal,
  onNote,
  onDone,
  onSkip,
  onClear,
  onDelete,
  onSetUrl,
  onEditTitle,
  onEditDetail,
  onEditSlot,
}: {
  title: string;
  timeSlot?: string | null;
  detail: string | null;
  url: string | null;
  state: PlanState;
  noteRequired: boolean;
  notePlaceholder: string;
  noteVal: string;
  onNote: (v: string) => void;
  onDone: () => void;
  onSkip: () => void;
  onClear: () => void;
  onDelete?: () => void; // 仅计划外（自己加的）传，用来删除
  onSetUrl?: (v: string) => void; // 仅计划外传，点「＋加链接」就地写链接
  /** 2026-09-20 Rosie：「我未必按你安排的学一模一样」——计划卡的标题/详解/时间全部可就地改。
   *  三个都可选：工作卡（来自待办）不传就保持只读。 */
  onEditTitle?: (v: string) => void;
  onEditDetail?: (v: string) => void;
  onEditSlot?: (v: string) => void;
}) {
  const done = state === "done";
  const skip = state === "skip";
  const canCheck = !noteRequired || done || noteVal.trim().length > 0;
  return (
    // 已决定的**不压缩、不折叠**，只换颜色（2026-07-29 Rosie 定）：已完成绿、未完成黄。
    // 用淡底 + 左色条而不是实心色块——面积大但强度低，扫得见又不刺眼。
    // 也不再整卡 opacity-60：那会让笔记文字一起变灰、看不清。
    <div
      className={cn(
        CARD,
        "border-l-4",
        done && "border-emerald-300 border-l-emerald-500 bg-emerald-50/40",
        skip && "border-amber-300 border-l-amber-500 bg-amber-50/40",
        !done && !skip && "border-l-transparent",
      )}
    >
      {/* 一行的顺序（2026-07-29 Rosie 定）：时间 · 标题 …… 视频 · 状态键 · 删除。
          状态键从最左挪到最右——最好的位置该给标题，不该给每张卡都长一样的两个按钮。 */}
      <div className="flex items-center gap-3">
        {onEditSlot ? (
          <EditableText
            value={timeSlot ?? ""}
            onSave={onEditSlot}
            placeholder="＋时间"
            className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground"
            inputClassName="w-28 text-xs"
          />
        ) : (
          timeSlot && (
            <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
              {timeSlot}
            </span>
          )
        )}
        {onEditTitle ? (
          // 标题用多行组件（2026-09-20 修）：原来是单行 EditableText，她粘贴三行会被浏览器
          // 压成一行。现在 Ctrl+Enter 换行、Enter 保存，保存时 Page 按行拆成多条（一行一个事件）
          <EditableParagraph
            value={title}
            onSave={onEditTitle}
            placeholder="条目名"
            className={cn("min-w-0 flex-1 cursor-text text-base font-medium whitespace-pre-line", done && "line-through")}
            inputClassName="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-base font-medium outline-none ring-1 ring-primary/30"
          />
        ) : (
          <span className={cn("min-w-0 flex-1 text-base font-medium", done && "line-through")}>{title}</span>
        )}
        {url && (
          <button
            onClick={() => openLink(url)}
            title={url}
            className="flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-primary hover:bg-accent"
          >
            <Play className="size-3.5" /> 视频
          </button>
        )}
        <DoneToggle
          state={state}
          canComplete={canCheck}
          onDone={onDone}
          onSkip={onSkip}
          onClear={onClear}
          disabledHint="先写「做了什么」才能标记完成"
        />
        {onDelete && (
          <button onClick={onDelete} title="删除（计划外·自己加的）" className="shrink-0 text-muted-foreground hover:text-destructive">
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
      {onEditDetail ? (
        <EditableParagraph value={detail ?? ""} onSave={onEditDetail} placeholder="＋写点说明（怎么学由你定，点击编辑）" />
      ) : (
        detail && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{detail}</p>
      )}
      {onSetUrl ? (
        // 计划外（自己加的）：给一行可就地编辑的链接，点一下即可写/改
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          <span className="shrink-0 text-muted-foreground">链接</span>
          <EditableText
            value={url ?? ""}
            onSave={onSetUrl}
            placeholder="＋ 加个链接（可选）"
            className="min-w-0 flex-1 truncate text-primary/80"
            inputClassName="w-full text-xs"
          />
        </div>
      ) : null
      /* 原来这儿还会把整条网址用小字铺出来——跟右上角那个按钮完全重复，而且
         等宽长网址是整张卡最丑的一处（2026-07-29 Rosie 指出）。已删除，
         要打开就点「视频」，想看地址 hover 按钮有 title。 */
      }
      <input
        value={noteVal}
        onChange={(e) => onNote(e.target.value)}
        placeholder={done ? "已完成" : notePlaceholder + (noteRequired ? "（写了才能打勾）" : "（选填）")}
        className="mt-2.5 h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary/40"
      />
    </div>
  );
}

function Page() {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [checkMap, setCheckMap] = useState<Map<string, CheckStatus>>(new Map());
  const [cycleStart, setCycleStart] = useState<string | null>(null);
  // 四个 tab 进 URL（#/study-plan/today、/week、/roadmap；**当前＝无子段**，是默认视图）
  // ——在任意 tab 里刷新都不再被弹回默认
  const [sub, navSub] = useSubPath("study-plan");
  const tab: PlanTab = (PLAN_TABS as readonly string[]).includes(sub[0])
    ? (sub[0] as PlanTab)
    : "current";
  const setTab = useCallback(
    (t: PlanTab) => navSub(t === "current" ? [] : [t]),
    [navSub],
  );
  const [newDay, setNewDay] = useState("*");
  const [newTrack, setNewTrack] = useState<Track>("sport");
  const [newTime, setNewTime] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const today = todayStr();
  const todayNum = dayNumOf(today);

  const [seedOutdated, setSeedOutdated] = useState(false);
  const [periodOn, setPeriodState] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [todos, setTodos] = useState<Todo[]>([]);
  const [selected, setSelected] = useState<string | null>(null); // 今天视图手动查看的领域
  const [yChecks, setYChecks] = useState<Set<string>>(new Set()); // 昨天的打卡（睡前拉伸可次日补勾）

  const yesterday = addDays(today, -1);
  // 本周一~日日期（一周视图 + 补卡用）
  const [frames, setFrames] = useState<PlanItem[]>([]);
  const [mealTexts, setMealTexts] = useState<Record<string, string>>({});
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(mondayOf(today), i));
  // 本周各天的打卡状态（补卡：可改「今天及以前」任意一天）
  const [weekChecks, setWeekChecks] = useState<Record<string, Map<string, CheckStatus>>>({});

  useEffect(() => {
    // ⚠️ 别直接 setItems(seedIfEmpty 的返回值)：它是会话级缓存的单例 Promise（StrictMode 防双跑），
    // 拿到的是本会话**第一次**读库的列表——她在日程页改完切回来会看到幽灵旧数据（2026-09-20 实锤）。
    // 播种自愈归它，数据必须现查。
    seedIfEmpty()
      .then(() => listItems())
      .then(setItems);
    // 全天轴（2026-09-20 J3 改版）：骨架条目 + 今天的三餐内容（饮食模块互通，只读展示）
    listAllItems().then((all) => setFrames(all.filter((i) => i.track === "frame"))).catch(() => {});
    getMeals(today)
      .then((m) =>
        setMealTexts({
          早餐: m.早.content ?? "",
          午餐: m.午.content ?? "",
          晚餐: m.晚.content ?? "",
        }),
      )
      .catch(() => {});
    listCheckStatus(today).then(setCheckMap);
    getCycleStart().then(setCycleStart);
    getSeedVersion().then((v) => setSeedOutdated(v < latestSeedVersion()));
    getPeriodOn().then(setPeriodState);
    listNotes(today).then((m) => setNotes(Object.fromEntries(m)));
    listTodos().then(setTodos);
    listChecks(yesterday).then(setYChecks);
    // 载入本周「今天及以前」各天的打卡状态，供一周视图补卡
    (async () => {
      const wk: Record<string, Map<string, CheckStatus>> = {};
      for (const d of weekDates) {
        if (d <= today) wk[d] = await listCheckStatus(d);
      }
      setWeekChecks(wk);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, yesterday]);

  // 补卡：改某天某条目的打卡状态（写对应日期，并更新本地）
  async function setStatusForDate(item: PlanItem, date: string, next: CheckStatus | null) {
    setWeekChecks((prev) => {
      const m = new Map(prev[date] ?? []);
      if (next === null) m.delete(item.id);
      else m.set(item.id, next);
      return { ...prev, [date]: m };
    });
    if (date === today) {
      setCheckMap((prev) => {
        const m = new Map(prev);
        if (next === null) m.delete(item.id);
        else m.set(item.id, next);
        return m;
      });
    }
    await setCheckStatus(item.id, date, next);
  }

  // 经期开关打开时：隐藏 skip 项、把 swap 项换成经期版
  const shown = items
    .map((i) => applyPeriod(i, periodOn))
    .filter((i): i is PlanItem => i !== null);

  async function handleSyncTemplate() {
    if (
      window.confirm(
        "把每日条目更新为最新计划模板？自定义条目和已打的勾会被清掉。",
      )
    ) {
      const fresh = await resetToSeed();
      setItems(fresh);
      setCheckMap(new Map());
      setSeedOutdated(false);
    }
  }

  const week = cycleStart ? cycleWeekOf(cycleStart, today) : 1;
  const todays = shown.filter((i) => matchesDay(i, todayNum, today));
  const doneCount = todays.filter((i) => checkMap.get(i.id) === "done").length;

  // 待做(pending)排上面，已决定(done/skip)沉到下面；同组保持原顺序
  const stateOf = (id: string): PlanState => checkMap.get(id) ?? "pending";
  const pendingFirst = (list: PlanItem[]) =>
    [...list].sort(
      (a, b) => Number(stateOf(a.id) !== "pending") - Number(stateOf(b.id) !== "pending"),
    );

  // 今天视图：按当前时间自动定位的领域（可手动切换查看）
  // 周末（周六/日）不上班，隐藏「工作」域，时间轴只走周末该有的
  const isWeekend = todayNum === 6 || todayNum === 7;
  const domains = DOMAINS.filter((d) => !(d.weekdaysOnly && isWeekend))
    // ⚠️ 今天一条都没有的 plan 域不上轴（否则工作日会冒出两个空「学习」跟上午的工作撞一起）
    .filter((d) => d.source !== "plan" || domainItems(d, todays).length > 0);
  const autoKey = autoDomainKey(domains, items, todayNum);
  const activeKey = selected ?? autoKey;
  const active = domains.find((d) => d.key === activeKey) ?? domains.find((d) => d.key === autoKey)!;

  /** 全天轴（2026-09-20 Rosie 选 J3 迷你卡轴 + 要求「把全天的日程盖上去」）：
   *  领域卡（可点，进右侧大卡）+ 骨架卡（三餐/通勤/日日学/家务等，背景信息）按时间混排。
   *  工作日/周末自动不同——骨架和条目本来就带 days。骨架里的「工作」不放（工作域卡已有）、
   *  「缓冲」不放（5 分钟填缝是噪音）。三餐卡显示饮食模块填的内容（早餐｜茶叶蛋+豆浆），
   *  点三餐跳饮食页、点日日学跳日日学。 */
  const axisRows: (
    | { kind: "domain"; key: string; start: number; end: number; d: Domain }
    | { kind: "frame"; key: string; start: number; end: number; it: PlanItem; label: string; jump?: string }
  )[] = [
    ...domains.map((d) => {
      let s = Infinity;
      for (const it of domainItems(d, todays)) {
        const v = slotStartMin(it);
        if (v > 0) s = Math.min(s, v);
      }
      return { kind: "domain" as const, key: `d-${d.key}`, start: s === Infinity ? d.start : s, end: domainEndMin(d, todays), d };
    }),
    ...frames
      .filter((f) => matchesDay(f, todayNum, today) && f.title !== "工作" && f.title !== "缓冲")
      .map((f) => ({
        kind: "frame" as const,
        key: `f-${f.id}`,
        start: slotStartMin(f),
        end: slotEndMin(f) > 0 ? slotEndMin(f) : slotStartMin(f),
        it: f,
        label: mealTexts[f.title] ? `${f.title}｜${mealTexts[f.title]}` : f.title,
        jump: f.title.includes("餐") ? "#/supplement" : f.title === "日日学" ? "#/study-log" : undefined,
      })),
  ].sort((a, b) => a.start - b.start);
  /**
   * 红虚线＝此刻。**按「已经结束」判，不按「已经开始」判**（2026-09-22 Rosie：
   * 10:25 明明在工作 10:15–12:00 当中，红线却画在工作卡下面，像是工作已经过去了）。
   * 现在的规则：红线画在**最后一个已结束的行之后**，所以正在进行的那一块永远在红线**下面**
   * ——线下就是「此刻及以后要做的」，跟「回到此刻」的语义一致。
   */
  const nowIdx = axisRows.reduce((acc, r, i) => (r.end <= nowMinutes() ? i : acc), -1);
  /**
   * 计划里所有学习类条目的标题（英语/AI/认证）——**工作域的兜底过滤用**。
   *
   * ⚠️ 2026-09-22 Rosie：「工作的类目应该是待办里的工作且今天，不该包含学习」。
   * 截图里「新概念学习／口语跟读／单词背诵」跑进了工作栏。根因有两层：
   *  ① 它们是 9/20 在日程里写英语三行时 `createTodoIfMissing` 顺手建的复印件（现在已改引用模式，不再建）；
   *  ② 本该被 `t.source === "study"` 挡住，但**云端 todos 表还没加 source 列**（她那句 ALTER 还没跑），
   *     同步下来 source 恒为空 ⇒ 过滤形同不存在。
   * 所以这里再加一道**按标题**的兜底：标题跟任一学习计划条目同名的待办，不进工作域。
   * 待办页 `isStudyShadow` 用的是同一个思路，别只改一处。
   */
  const studyTitles = new Set(
    items.filter((i) => i.track === "english" || i.track === "ai" || i.track === "cert").map((i) => i.title),
  );
  /**
   * 工作域「今天该露面」的待办：未完成的（due≤今天，含逾期）+ **今天**完成的。
   * 今天以前就完成的不算——那些归待办页的「历史已完成」。
   *
   * ⚠️ 抽成函数是因为**列表和进度必须用同一个判断**：原先进度那边只过滤了
   * `due_date <= today`，把历史上所有标过「今天」且早已做完的待办算进了分母，
   * 于是出现「右边列表空的，左轴却显示工作 10/10」（2026-07-29 Rosie 发现）。
   * 跟 domainItems 同一个教训：同一套判断写两遍就会走偏。
   */
  function todaysWorkTodos(): Todo[] {
    return todos
      .filter(
        (t) => t.due_date && t.due_date <= today && (!t.done || (t.done_at ?? "").slice(0, 10) === today) && !isStaleStudyTodo(t, today) && t.source !== "study" && !studyTitles.has(t.title),
      )
      .sort((a, b) => Number(!!a.done) - Number(!!b.done)); // 今天完成的沉到最下，不消失
  }

  const planCards = active.source === "plan" ? pendingFirst(domainItems(active, todays)) : [];
  const todoCards = active.source === "todo" ? todaysWorkTodos() : [];

  /** 每个领域今天的完成度（左侧时间轴的迷你进度条 + 「今天」清单的分组角标） */
  function domainProgress(d: Domain): { done: number; total: number } {
    if (d.source === "todo") {
      const list = todaysWorkTodos();
      return { done: list.filter((t) => t.done).length, total: list.length };
    }
    const list = domainItems(d, todays);
    return { done: list.filter((i) => stateOf(i.id) === "done").length, total: list.length };
  }

  // 「当前」右侧按三态分栏。⚠️ 三态要分清（Rosie 要求）：
  // 今日计划(pending) / 已完成(done) / 未完成(skip)——skip 不能跟「还没做」混在一起，那是主动决定今天不做。
  const curPending = planCards.filter((i) => stateOf(i.id) === "pending");
  const curDone = planCards.filter((i) => stateOf(i.id) === "done");
  const curSkip = planCards.filter((i) => stateOf(i.id) === "skip");
  // 工作域来自待办，没有 skip 概念
  const todoPending = todoCards.filter((t) => !t.done);
  const todoDone = todoCards.filter((t) => t.done);

  // ---- 「今日计划」清空时的庆祝 ----
  const pendingLeft = active.source === "todo" ? todoPending.length : curPending.length;
  const skipLeft = active.source === "todo" ? 0 : curSkip.length;
  const decidedTotal = active.source === "todo" ? todoCards.length : planCards.length;
  const [cheer, setCheer] = useState<{ fire: boolean; text: string } | null>(null);
  // 记上一次的待做数**和当时是哪个领域**：只在「同一个领域里从 >0 变成 0」时触发。
  // 不带 key 比对的话，从有待做的领域切到已清空的领域也会误放烟花。
  const prevPending = useRef<{ key: string; n: number } | null>(null);
  useEffect(() => {
    const prev = prevPending.current;
    prevPending.current = { key: activeKey, n: pendingLeft };
    if (!prev || prev.key !== activeKey) return; // 刚切领域，不算「刚做完」
    if (prev.n === 0 || pendingLeft !== 0 || decidedTotal === 0) return;
    // ⚠️ 文案必须说**这一个领域**（2026-07-30 修）：触发条件只是当前领域的待做清空，一天有六七个领域，
    // 原来那句「今日计划都处理完了 🎉」是在骗人——Rosie 今天 2/12 就撞上了。要改成全天级请连触发条件一起改，
    // 别只改文案（她 2026-07-30 明确选了「保持领域级，只把文案改对」）。
    setCheer(
      skipLeft === 0
        ? { fire: true, text: `${active.name}都做完了 🎉` }
        : { fire: false, text: pickCheer() },
    );
  }, [activeKey, active.name, pendingLeft, skipLeft, decidedTotal]);
  // 鼓励语几秒后自己消失；烟花那条由 Fireworks 播完回调来关
  useEffect(() => {
    if (!cheer || cheer.fire) return;
    const t = window.setTimeout(() => setCheer(null), 6000);
    return () => window.clearTimeout(t);
  }, [cheer]);

  // 「今天没勾=没完成」，唯一例外是睡前拉伸：昨天该做却没打勾的，今早还能补一勾
  const graceItems = items.filter(
    (i) =>
      i.title.includes("睡前拉伸") &&
      matchesDay(i, dayNumOf(yesterday), yesterday) &&
      !yChecks.has(i.id),
  );

  async function checkGraceYesterday(item: PlanItem) {
    await toggleCheck(item.id, yesterday);
    setYChecks((prev) => new Set(prev).add(item.id));
  }

  // 只用 id ⇒ 参数收窄成 Pick，工作域的 todo 也能借它写 skip（plan_checks 按 id+日期存，不挑表）
  async function setStatus(item: Pick<PlanItem, "id">, next: CheckStatus | null) {
    setCheckMap((prev) => {
      const m = new Map(prev);
      if (next === null) m.delete(item.id);
      else m.set(item.id, next);
      return m;
    });
    await setCheckStatus(item.id, today, next);
  }

  async function toggleWork(t: Todo) {
    setTodos((ts) => ts.map((x) => (x.id === t.id ? { ...x, done: x.done ? 0 : 1 } : x)));
    await toggleTodo(t.id, !t.done);
  }

  // 在「工作」域加一条 → 建一条今天·重要紧急待办（待办↔工作双向）
  async function addWorkTodo(title: string) {
    const order = Math.max(0, ...todos.map((x) => x.sort_order)) + 1;
    const t = await createTodo(title, "iu", today, order);
    setTodos((ts) => [...ts, t]);
  }

  // 在计划领域加一条「计划外」（自己练/做的，今天该 track），可删；原定计划不可删
  async function addExtra(track: Track, title: string) {
    const order = Math.max(0, ...items.map((i) => i.sort_order)) + 1;
    const item = await createItem({ track, days: String(dayNumOf(today)), time_slot: null, title }, order);
    setItems((its) => [...its, item]);
  }

  function saveNote(id: string, v: string) {
    setNotes((s) => ({ ...s, [id]: v }));
    setNote(id, today, v);
  }

  /** 编辑后整表现查——editItemFrom 会给历史条目封存+另起新行（id 变了），本地打补丁跟不上 */
  async function refreshItems() {
    setItems(await listItems());
  }

  /** 所有编辑走 editItemFrom（2026-09-20 铁律「默认变更只变当天以及以后」）：
   *  历史条目＝旧行封存到昨天+新内容今天另起一行，过去的学习痕迹原样保留 */
  async function handleRename(item: PlanItem, title: string) {
    await editItemFrom(item, { title }, today);
    await refreshItems();
  }

  async function handleDelete(item: PlanItem) {
    await retireOrDeleteItem(item, today);
    await refreshItems();
  }

  async function handleSetUrl(id: string, url: string) {
    setItems((its) => its.map((i) => (i.id === id ? { ...i, url: url || null } : i)));
    await updateItemUrl(id, url);
  }

  /** 标题多行拆分（2026-09-20 她定的连贯流程：时间轴只放空框架、内容去日日学写）：
   *  第一行改在原条目上（只改今天起），后面每行各成一条新条目（同时段同 track 同 days），
   *  英语/学习的新行照规矩同步一条今天·重要紧急待办。 */
  async function handleRenameMulti(item: PlanItem, text: string) {
    const lines = text.split("\n").map((s) => s.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const [first, ...rest] = lines;
    if (first !== item.title) await editItemFrom(item, { title: first }, today);
    let order = Math.max(0, ...items.map((x) => x.sort_order));
    for (const ln of rest) {
      await createItem({ track: item.track, days: item.days, time_slot: item.time_slot, title: ln }, ++order);
      // 学习行不再复印进待办（2026-09-20 重构）：待办页「今日学习」直接引用 plan_items
    }
    await refreshItems();
  }

  // 2026-09-20 起计划卡的详解/时间也可就地改（她按自己的思路学，内容她说了算）——同样只改今天起
  async function handleSetDetail(item: PlanItem, detail: string) {
    await editItemFrom(item, { detail: detail || null }, today);
    await refreshItems();
  }
  async function handleSetSlot(item: PlanItem, slot: string) {
    await editItemFrom(item, { time_slot: slot.trim() || null }, today);
    await refreshItems();
  }

  async function handleCreate() {
    const title = newTitle.trim();
    if (!title) return;
    const maxOrder = Math.max(0, ...items.map((i) => i.sort_order));
    const item = await createItem(
      {
        track: newTrack,
        days: newDay,
        time_slot: newTime.trim() || null,
        title,
        url: newUrl.trim() || null,
      },
      maxOrder + 1,
    );
    setItems((its) => [...its, item]);
    setNewTitle("");
    setNewUrl("");
  }

  /** 领域内条目的「我做了什么」提示语 */
  function placeholderFor(active: Domain, track?: Track): string {
    if (active.source === "todo") return "我具体做了什么？";
    if (track === "reading") return "看到哪本书的哪里？如：《她对此感到厌烦》第3章";
    if (track === "english") return "今天做了什么？如：刷完001";
    return "看了哪个视频 / 做了什么？";
  }

  return (
    <div className={PAGE}>
      {/* 头部一行（2026-09-20 Rosie：日期/现在/今日进度/适应周提示挪到一行、居右；tab 已撤） */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">时间轴</h1>
        {periodOn && (
          <span className="rounded-full border border-pink-300 bg-pink-50 px-3 py-0.5 text-sm text-pink-700">
            🩸 经期中 · 已避开腹部
          </span>
        )}
        <span className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
          <span className="text-sm text-muted-foreground">{formatDateCn(today)}</span>
          {/* 「现在」药丸收进蓝色系（她说红色太跳）；轴上的红虚线保留做定位 */}
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F1FB] px-2.5 py-0.5 text-xs text-[#185FA5]"
            title="按当前时间自动定位到该做的领域"
          >
            <span className="size-1.5 rounded-full bg-[#2E7CD6]" />
            现在 {String(Math.floor(nowMinutes() / 60)).padStart(2, "0")}:
            {String(nowMinutes() % 60).padStart(2, "0")} · 自动跟随
          </span>
          <span className="flex items-center gap-2 text-sm">
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-primary transition-all"
                style={{ width: todays.length ? `${(doneCount / todays.length) * 100}%` : 0 }}
              />
            </span>
            <span className="text-muted-foreground">
              今日 <b className="font-medium text-foreground">{doneCount}</b>/{todays.length}
            </span>
          </span>
          <span className="rounded-full bg-accent px-3 py-0.5 text-sm font-medium text-accent-foreground">
            周期第 {week} 周
          </span>
          <span className="text-sm text-muted-foreground">{CYCLE_PHASES[(week - 1) % 4]}</span>
        </span>
      </div>

      {seedOutdated && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
          <p className="text-sm text-amber-800">
            <span className="font-medium">计划模板有更新</span>
            ——新的条目/视频链接还没进你的列表
          </p>
          <Button size="sm" variant="outline" className="ml-auto shrink-0" onClick={handleSyncTemplate}>
            一键同步
          </Button>
        </div>
      )}
      {tab === "current" ? (
        <>
          {selected && selected !== autoKey && (
            <div className="mb-3">
              <button className="text-sm text-primary hover:underline" onClick={() => setSelected(null)}>
                ← 回到此刻
              </button>
            </div>
          )}

          {/* 睡前拉伸次日补勾：其余任务过了今天不再补，只有它有宽限 */}
          {graceItems.map((i) => (
            <div
              key={i.id}
              className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5"
            >
              <span className="text-sm text-teal-800">
                昨晚的「{i.title}」还没打勾——现在补也算昨天完成
              </span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto shrink-0"
                onClick={() => checkGraceYesterday(i)}
              >
                补勾昨天
              </Button>
            </div>
          ))}

          <div className="flex gap-6">
            {/* 左：全天轴（J3 迷你卡，2026-09-20 Rosie 选定）：领域卡可点、骨架卡是背景，
                按时间混排铺满一天；红虚线=现在（她点名要保留）。 */}
            <div className="w-44 shrink-0 sm:w-52">
              <div className="flex flex-col gap-2">
                {axisRows.map((row, idx) => (
                  <div key={row.key}>
                    {row.kind === "domain" ? (
                      (() => {
                        const d = row.d;
                        const isActive = d.key === activeKey;
                        const p = domainProgress(d);
                        const allDone = p.total > 0 && p.done === p.total;
                        return (
                          <button
                            onClick={() => setSelected(d.key)}
                            className="w-full rounded-xl border bg-card px-3 py-2 text-left transition-all hover:border-primary/50"
                            style={
                              isActive
                                ? { borderColor: d.color, boxShadow: `0 0 0 1.5px ${d.color}`, background: d.tint }
                                : undefined
                            }
                            title={`${d.name} ${p.done}/${p.total}`}
                          >
                            <span className="flex items-baseline gap-1.5">
                              <span
                                className="text-[15px]"
                                style={{ color: isActive ? d.textc : undefined, fontWeight: isActive ? 600 : 500 }}
                              >
                                {d.name}
                              </span>
                              <span className="text-[11px] tabular-nums text-muted-foreground">
                                {p.done}/{p.total}
                              </span>
                              {allDone && <span className="text-[11px] text-emerald-600">✓</span>}
                              {/* 「现在」文字撤了（2026-09-20 Rosie：位置怎么摆都别扭，红虚线足够判断） */}
                            </span>
                            <span className="block text-xs tabular-nums text-muted-foreground">
                              {domainTimeLabel(d, todays)}
                            </span>
                            <MiniBar done={p.done} total={p.total} color={d.color} />
                          </button>
                        );
                      })()
                    ) : (
                      <div
                        onClick={row.jump ? () => (window.location.hash = row.jump!) : undefined}
                        title={row.jump ? "点击打开对应模块" : undefined}
                        className={cn(
                          "rounded-xl bg-muted/50 px-3 py-1.5",
                          row.jump && "cursor-pointer transition-colors hover:bg-muted",
                        )}
                      >
                        <span className="block truncate text-[13px] text-muted-foreground">{row.label}</span>
                        <span className="block text-[11px] tabular-nums text-muted-foreground/70">
                          {row.it.time_slot}
                        </span>
                      </div>
                    )}
                    {idx === nowIdx && <div className="mt-2 border-t-2 border-dashed border-red-400" />}
                  </div>
                ))}
              </div>
            </div>

            {/* 右：当前领域内容（大卡片，含详细解释） */}
            <div className="min-w-0 flex-1 border-l pl-6">
              <div className="mb-4 flex items-baseline gap-2">
                <span className="text-xl font-semibold" style={{ color: active.textc }}>
                  {active.name}
                </span>
                <span className="text-sm text-muted-foreground">
                  {active.source === "todo" ? "今天要做的（来自待办）" : ""}
                </span>
              </div>
              {/* 加一行（工作域＝加待办，计划域＝加计划外）始终在最上 */}
              <div className="mb-3">
                {active.source === "todo" && (
                  <QuickAdd placeholder="加一件今天的工作（→ 待办·重要紧急）" cta="加" onAdd={addWorkTodo} />
                )}
                {active.source === "plan" && active.tracks && (
                  <QuickAdd
                    placeholder={`加一条计划外的（自己练/做的，今天记进「${active.name}」，可删）`}
                    cta="新增"
                    variant="outline"
                    onAdd={(title) => addExtra(active.tracks![0], title)}
                  />
                )}
              </div>

              {/* 清空这一段时的反馈：全做完＝烟花+🎉，有未完成＝一句鼓励（不放烟花） */}
              {cheer && (
                <div
                  className={cn(
                    "mb-3 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm",
                    cheer.fire
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-sky-200 bg-sky-50 text-sky-800",
                  )}
                >
                  <span>{cheer.text}</span>
                  <button
                    onClick={() => setCheer(null)}
                    className="ml-auto shrink-0 text-xs opacity-60 hover:opacity-100"
                    title="关掉"
                  >
                    ✕
                  </button>
                </div>
              )}
              {cheer?.fire && <Fireworks onDone={() => setCheer(null)} />}

              {/* 单栏，按状态排序（2026-07-29 Rosie 定稿）：
                  待做在上、已完成和未完成沉到底下，**卡片保持原样大小不压缩、不折叠**，
                  只是整张卡换个底色（完成=绿 / 未完成=黄）。
                  ⚠️ 原来那版分成左右两栏，八成时间右栏是空的、白占半个屏幕；
                  全标完之后又反过来主次颠倒。单栏 + 换色沉底两个问题一起没了。 */}
              <div>
                <div>
                  <div className="mb-2 flex items-center gap-2 border-b pb-1.5 text-sm">
                    <span className="font-medium">今日计划</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {active.source === "todo"
                        ? `${todoPending.length} 待做 · ${todoDone.length} 已完成`
                        : `${curPending.length} 待做 · ${curDone.length} 已完成 · ${curSkip.length} 未完成`}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {active.source === "plan" &&
                      [...curPending, ...curDone, ...curSkip].map((i) => (
                        <ThreeRowCard
                          key={i.id}
                          title={i.title}
                          timeSlot={i.time_slot}
                          detail={i.detail}
                          url={i.url}
                          state={stateOf(i.id)}
                          noteRequired={active.noteRequired}
                          notePlaceholder={placeholderFor(active, i.track)}
                          noteVal={notes[i.id] ?? ""}
                          onNote={(v) => saveNote(i.id, v)}
                          onDone={() => setStatus(i, "done")}
                          onSkip={() => setStatus(i, "skip")}
                          onClear={() => setStatus(i, null)}
                          onDelete={isSeedItem(i) ? undefined : () => handleDelete(i)}
                          onSetUrl={isSeedItem(i) ? undefined : (v) => handleSetUrl(i.id, v)}
                          onEditTitle={(v) => handleRenameMulti(i, v)}
                          onEditDetail={(v) => handleSetDetail(i, v)}
                          onEditSlot={(v) => handleSetSlot(i, v)}
                        />
                      ))}
                    {active.source === "todo" &&
                      [...todoPending, ...todoDone].map((t) => (
                        <ThreeRowCard
                          key={t.id}
                          title={t.title}
                          detail={null}
                          url={null}
                          state={t.done ? "done" : stateOf(t.id)}
                          noteRequired={active.noteRequired}
                          notePlaceholder={placeholderFor(active)}
                          noteVal={notes[t.id] ?? ""}
                          onNote={(v) => saveNote(t.id, v)}
                          onDone={() => {
                            if (stateOf(t.id) === "skip") void setStatus({ id: t.id }, null);
                            toggleWork(t);
                          }}
                          // 待办也能标「今天做不了」（2026-09-20 Rosie：未完成点不了不合理）——
                          // 借 plan_checks 存 skip（按 id+日期），明天自动回待做，零改表
                          onSkip={() => setStatus({ id: t.id }, "skip")}
                          onClear={() => (t.done ? toggleWork(t) : void setStatus({ id: t.id }, null))}
                        />
                      ))}
                    {(active.source === "todo" ? todoCards.length : planCards.length) === 0 && (
                      <p className="py-8 text-sm text-muted-foreground">
                        {active.source === "todo"
                          ? "今天没有工作待办——上面加一条，或去待办把要做的点进今天。"
                          : "这个时段今天没有安排。"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : tab === "today" ? (
        /* 「今天」＝全天紧凑清单：一条一行，13 条一屏扫完 + 随手补勾。
           详解截断成一行、不放笔记框——要写笔记去「当前」（分工见 PLAN_TABS 注释）。 */
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-sm text-muted-foreground">{formatDateCn(today)}</p>
            <span className="flex items-center gap-2 text-sm">
              <span className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-primary transition-all"
                  style={{ width: todays.length ? `${(doneCount / todays.length) * 100}%` : 0 }}
                />
              </span>
              <span className="text-muted-foreground">
                今日 <b className="font-medium text-foreground">{doneCount}</b>/{todays.length}
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              需要写「做了什么」才能打勾的（英语/学习/阅读），到「当前」里写
            </span>
          </div>

          {/* A3 分组卡片（2026-07-29 Rosie 选）：每条线独立一张圆角卡、卡头用领域色，
              视觉分组最清楚，一眼看出「这是运动那一块」。 */}
          <div className="space-y-3">
            {domains.map((d) => {
              const p = domainProgress(d);
              const isNow = d.key === autoKey;
              const planRows = d.source === "plan" ? pendingFirst(domainItems(d, todays)) : [];
              const todoRows = d.source === "todo" ? todaysWorkTodos() : [];
              if (planRows.length === 0 && todoRows.length === 0) return null;
              return (
                <div
                  key={d.key}
                  className={cn(
                    "overflow-hidden rounded-xl border bg-card",
                    isNow && "ring-1",
                  )}
                  style={isNow ? { borderColor: d.color + "66", boxShadow: `0 0 0 1px ${d.color}33` } : undefined}
                >
                  <div
                    className="flex items-center gap-2 border-b px-3 py-2"
                    style={{ background: isNow ? d.tint : "color-mix(in oklab, var(--color-muted) 60%, transparent)" }}
                  >
                    <span className="size-2 shrink-0 rounded-full" style={{ background: d.color }} />
                    <span className="text-sm font-medium" style={{ color: d.textc }}>
                      {d.name}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">{domainTimeLabel(d, todays)}</span>
                    {isNow && <span className="text-xs text-red-500">← 现在</span>}
                    <span className="ml-auto flex items-center gap-2">
                      <span className="h-1 w-16 overflow-hidden rounded-full bg-background">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: p.total ? `${(p.done / p.total) * 100}%` : 0, background: d.color }}
                        />
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {p.done}/{p.total}
                      </span>
                      <button
                        onClick={() => {
                          setSelected(d.key);
                          setTab("current");
                        }}
                        className="text-xs text-primary hover:underline"
                        title="去「当前」处理这一段（能写笔记、看详解）"
                      >
                        去处理 →
                      </button>
                    </span>
                  </div>
                  {planRows.map((i) => (
                    <CompactRow
                      key={i.id}
                      title={i.title}
                      timeSlot={i.time_slot}
                      detail={i.detail}
                      url={i.url}
                      state={stateOf(i.id)}
                      canCheck={!d.noteRequired || (notes[i.id] ?? "").trim().length > 0}
                      onDone={() => setStatus(i, "done")}
                      onSkip={() => setStatus(i, "skip")}
                      onClear={() => setStatus(i, null)}
                    />
                  ))}
                  {todoRows.map((t) => (
                    <CompactRow
                      key={t.id}
                      title={t.title}
                      timeSlot={null}
                      detail={null}
                      url={null}
                      state={t.done ? "done" : "pending"}
                      canCheck
                      onDone={() => toggleWork(t)}
                      onSkip={() => {}}
                      onClear={() => toggleWork(t)}
                    />
                  ))}
                </div>
              );
            })}
            {todays.length === 0 && (
              <p className="px-3 py-10 text-center text-sm text-muted-foreground">今天没有安排。</p>
            )}
          </div>
        </div>
      ) : tab === "roadmap" ? (
        /* 「日程」已于 2026-09-18 拆成独立模块（modules/schedule），侧栏直接进。 */
        <div className="mt-4 space-y-4">
          {/* 冲刺路线（2026-09-01 起的主路线）：阶段目标 + 她自己写「实际做了什么」。
              形态刻意不是预排周计划，理由在 roadmap.ts 顶部。 */}
          <RoadmapStages />

          <div className="rounded-lg border-l-4 border-primary bg-accent p-4 text-sm leading-relaxed text-accent-foreground">
            {SEMESTER_TARGET}
          </div>
          {/* 旧版月度计划（7 月定的，含体重/运动线仍有效，但学习线是重定向前的）收进折叠区 */}
          <Collapse title="7 月版月度计划（体重/运动线仍参考，学习线已被上面的冲刺路线取代）">
          {SEMESTER_PLAN.map((m) => (
            <section key={m.title} className={CARD}>
              <div className="mb-2 flex flex-wrap items-baseline gap-2">
                <h2 className={CARD_TITLE}>{m.title}</h2>
                <span className="text-sm text-muted-foreground">{m.period}</span>
                <span className="ml-auto rounded-full bg-red-50 px-3 py-0.5 text-sm text-red-700">
                  {m.weight}
                </span>
              </div>
              <div className="mb-3 grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["sport", m.goals.sport],
                    ["english", m.goals.english],
                    ["cert", m.goals.cert],
                    ["ai", m.goals.ai],
                  ] as [Track, string][]
                ).map(([t, text]) => (
                  <div key={t} className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5">
                    <TrackTag t={t} />
                    <span className="min-w-0 flex-1 text-[13px] leading-snug">{text}</span>
                  </div>
                ))}
              </div>
              <ul className="space-y-1 text-[13px] text-muted-foreground">
                {m.weeks.map((w) => (
                  <li key={w}>· {w}</li>
                ))}
              </ul>
            </section>
          ))}
          </Collapse>
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={handleSyncTemplate}
            >
              同步最新计划模板
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          <p className="text-xs text-muted-foreground">「今天及以前」的天都能补勾（漏打卡了倒回来补）；将来的天不能勾。</p>
          {[1, 2, 3, 4, 5, 6, 7].map((d) => {
            const dayItems = shown.filter((i) => matchesDay(i, d, weekDates[d - 1]));
            const dateD = weekDates[d - 1];
            const canBackfill = dateD <= today; // 今天及以前可勾/补卡
            const dayState = weekChecks[dateD] ?? new Map<string, CheckStatus>();
            return (
              <section key={d}>
                <h2
                  className={cn(
                    "mb-1.5 flex items-baseline gap-2 text-sm font-semibold",
                    d === todayNum ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {DAY_NAMES[d]}
                  <span className="text-xs font-normal text-muted-foreground/70">{dateD.slice(5)}</span>
                  {d === todayNum && "（今天）"}
                </h2>
                <div className="space-y-1.5">
                  {dayItems.map((item) => (
                    <ItemRow
                      key={`${d}-${item.id}`}
                      item={item}
                      withCheck={canBackfill}
                      noteGate={dateD === today}
                      state={dayState.get(item.id) ?? "pending"}
                      noteVal={notes[item.id] ?? ""}
                      onNote={(v) => saveNote(item.id, v)}
                      onDone={() => setStatusForDate(item, dateD, "done")}
                      onSkip={() => setStatusForDate(item, dateD, "skip")}
                      onClear={() => setStatusForDate(item, dateD, null)}
                      onRename={(v) => handleRename(item, v)}
                      onDelete={isSeedItem(item) ? undefined : () => handleDelete(item)}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {/* 新增条目 */}
          <section className="rounded-lg border bg-muted/30 p-3">
            <p className="mb-2 text-sm font-medium">添加条目</p>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={newDay} onValueChange={(v) => setNewDay(v ?? "*")}>
                <SelectTrigger className="w-24">
                  <SelectValue>
                    {(v) => (v === "*" ? "每天" : DAY_NAMES[Number(v)])}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="*">每天</SelectItem>
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {DAY_NAMES[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={newTrack} onValueChange={(v) => setNewTrack(v as Track)}>
                <SelectTrigger className="w-28">
                  <SelectValue>
                    {(v) => TRACKS.find((t) => t.key === v)?.name ?? "线路"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TRACKS.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      <span className={cn("mr-1 inline-block size-2 rounded-full", TRACK_STYLE[t.key].dot)} />
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                placeholder="19:00–19:40"
                className="w-32"
              />
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="做什么？"
                className="min-w-40 flex-1"
              />
              <Input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="视频链接（可选）"
                className="w-48"
              />
              <Button onClick={handleCreate}>
                <Plus className="size-4" /> 添加
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

const studyPlanModule: AppModule = {
  manifest: {
    id: "study-plan",
    name: "时间轴",
    icon: CalendarCheck,
    description: "一天的时间轴：养生/英语/工作/学习/运动/阅读",
    defaultSize: { w: 2, h: 1 },
  },
  Card,
  Page,
};

export default studyPlanModule;
