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
  deleteItem,
  getCycleStart,
  getPeriodOn,
  getSeedVersion,
  latestSeedVersion,
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
  updateItemTitle,
  updateItemUrl,
  type CheckStatus,
  type PlanItem,
  type Track,
} from "./data";
import { createTodo, listTodos, toggleTodo, type Todo } from "../todo/data";
import { SEED_ITEMS, SEMESTER_PLAN, SEMESTER_TARGET } from "./seed";

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
const PLAN_TABS = ["current", "today", "week", "roadmap"] as const;
type PlanTab = (typeof PLAN_TABS)[number];
const TAB_LABEL: Record<PlanTab, string> = {
  current: "当前",
  today: "今天",
  week: "一周",
  roadmap: "路线",
};

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
}

const DOMAINS: Domain[] = [
  // 养生只收上午的（泡脚/睡前拉伸这类晚间养生归到最后的「睡前」节点）
  { key: "wellness", name: "养生", start: 370, time: "6:10", color: "#1D9E75", tint: "#E1F5EE", textc: "#0F6E56", source: "plan", tracks: ["wellness"], noteRequired: false, timeMax: 720 },
  { key: "english", name: "英语", start: 450, time: "7:30", color: "#378ADD", tint: "#E6F1FB", textc: "#0C447C", source: "plan", tracks: ["english"], noteRequired: true },
  { key: "work", name: "工作", start: 560, time: "9:20", color: "#888780", tint: "#F1EFE8", textc: "#5F5E5A", source: "todo", noteRequired: false },
  { key: "study", name: "学习", start: 1140, time: "19:00", color: "#7F77DD", tint: "#EEEDFE", textc: "#534AB7", source: "plan", tracks: ["cert", "ai"], noteRequired: true },
  { key: "sport", name: "运动", start: 1180, time: "19:40", color: "#639922", tint: "#EAF3DE", textc: "#3B6D11", source: "plan", tracks: ["sport"], noteRequired: false },
  { key: "reading", name: "阅读", start: 1260, time: "21:00", color: "#D4537E", tint: "#FBEAF0", textc: "#993556", source: "plan", tracks: ["reading"], noteRequired: true },
  // 睡前：晚间养生（泡脚 21:00、睡前拉伸 21:40），按时间收 18:00 之后的 wellness 条目
  { key: "bedtime", name: "睡前", start: 1300, time: "21:40", color: "#1D9E75", tint: "#E1F5EE", textc: "#0F6E56", source: "plan", tracks: ["wellness"], noteRequired: false, timeMin: 1080 },
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

/** 分栏小标题（今日计划 / 已完成 / 未完成） */
function ColHead({ label, n, tone }: { label: string; n: number; tone?: "ok" | "skip" }) {
  return (
    <div className="mb-2 flex items-center gap-2 border-b pb-1.5">
      <span
        className={cn(
          "text-sm font-medium",
          tone === "ok" ? "text-emerald-700" : tone === "skip" ? "text-amber-700" : undefined,
        )}
      >
        {label}
      </span>
      <span className="text-xs tabular-nums text-muted-foreground">{n}</span>
    </div>
  );
}

/** 已完成／未完成 的窄条（不再占大卡片的位置，但笔记还看得见，可一键撤销） */
function DoneStrip({
  title,
  timeSlot,
  note,
  tone,
  onUndo,
}: {
  title: string;
  timeSlot: string | null;
  note: string;
  tone: "ok" | "skip";
  onUndo: () => void;
}) {
  return (
    <div
      className={cn(
        "group rounded-lg border px-3 py-2 text-sm",
        tone === "ok" ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50",
      )}
    >
      <div className="flex items-start gap-2">
        <span className={cn("shrink-0", tone === "ok" ? "text-emerald-600" : "text-amber-600")}>
          {tone === "ok" ? "✓" : "—"}
        </span>
        <span className={cn("min-w-0 flex-1", tone === "ok" && "line-through decoration-1")}>{title}</span>
        <button
          onClick={onUndo}
          className="invisible shrink-0 text-xs text-muted-foreground hover:text-foreground group-hover:visible"
          title="撤销，回到待做"
        >
          撤销
        </button>
      </div>
      {timeSlot && <p className="ml-5 text-[11px] tabular-nums text-muted-foreground">{timeSlot}</p>}
      {note.trim() && <p className="ml-5 mt-0.5 text-xs text-muted-foreground">做了：{note}</p>}
    </div>
  );
}

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
  return (
    <div className="grid items-center gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-accent/30"
      style={{ gridTemplateColumns: "94px minmax(0,1fr) minmax(0,1.1fr) auto auto" }}>
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

/** 当前时间落在哪个领域（最后一个 start<=now；早于第一个则养生） */
function autoDomainKey(): string {
  const now = nowMinutes();
  let key = DOMAINS[0].key;
  for (const d of DOMAINS) if (d.start <= now) key = d.key;
  return key;
}

const TRACK_STYLE: Record<Track, { bg: string; text: string; dot: string }> = {
  wellness: { bg: "bg-teal-50",    text: "text-teal-800",    dot: "bg-teal-500" },
  sport:    { bg: "bg-emerald-50", text: "text-emerald-800", dot: "bg-emerald-500" },
  english:  { bg: "bg-blue-50",    text: "text-blue-800",    dot: "bg-blue-500" },
  cert:     { bg: "bg-violet-50",  text: "text-violet-800",  dot: "bg-violet-500" },
  ai:       { bg: "bg-amber-50",   text: "text-amber-800",   dot: "bg-amber-500" },
  reading:  { bg: "bg-pink-50",    text: "text-pink-800",    dot: "bg-pink-500" },
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
      const todays = items.filter((i) => matchesDay(i, dayNum));
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
}) {
  const done = state === "done";
  const decided = state !== "pending";
  const canCheck = !noteRequired || done || noteVal.trim().length > 0;
  return (
    <div className={cn("rounded-xl border bg-card p-4", decided && "opacity-60")}>
      {/* 一行的顺序（2026-07-29 Rosie 定）：时间 · 标题 …… 视频 · 状态键 · 删除。
          状态键从最左挪到最右——最好的位置该给标题，不该给每张卡都长一样的两个按钮。 */}
      <div className="flex items-center gap-3">
        {timeSlot && (
          <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
            {timeSlot}
          </span>
        )}
        <span className={cn("min-w-0 flex-1 text-base font-medium", done && "line-through")}>{title}</span>
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
      {detail && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{detail}</p>}
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
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(mondayOf(today), i));
  // 本周各天的打卡状态（补卡：可改「今天及以前」任意一天）
  const [weekChecks, setWeekChecks] = useState<Record<string, Map<string, CheckStatus>>>({});

  useEffect(() => {
    seedIfEmpty().then(setItems);
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
  const todays = shown.filter((i) => matchesDay(i, todayNum));
  const doneCount = todays.filter((i) => checkMap.get(i.id) === "done").length;

  // 待做(pending)排上面，已决定(done/skip)沉到下面；同组保持原顺序
  const stateOf = (id: string): PlanState => checkMap.get(id) ?? "pending";
  const pendingFirst = (list: PlanItem[]) =>
    [...list].sort(
      (a, b) => Number(stateOf(a.id) !== "pending") - Number(stateOf(b.id) !== "pending"),
    );

  // 今天视图：按当前时间自动定位的领域（可手动切换查看）
  const autoKey = autoDomainKey();
  const activeKey = selected ?? autoKey;
  const active = DOMAINS.find((d) => d.key === activeKey)!;
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
        (t) => t.due_date && t.due_date <= today && (!t.done || (t.done_at ?? "").slice(0, 10) === today),
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
    setCheer(
      skipLeft === 0
        ? { fire: true, text: "今日计划都处理完了 🎉" }
        : { fire: false, text: pickCheer() },
    );
  }, [activeKey, pendingLeft, skipLeft, decidedTotal]);
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
      matchesDay(i, dayNumOf(yesterday)) &&
      !yChecks.has(i.id),
  );

  async function checkGraceYesterday(item: PlanItem) {
    await toggleCheck(item.id, yesterday);
    setYChecks((prev) => new Set(prev).add(item.id));
  }

  async function setStatus(item: PlanItem, next: CheckStatus | null) {
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

  async function handleRename(id: string, title: string) {
    setItems((its) => its.map((i) => (i.id === id ? { ...i, title } : i)));
    await updateItemTitle(id, title);
  }

  async function handleDelete(id: string) {
    setItems((its) => its.filter((i) => i.id !== id));
    await deleteItem(id);
  }

  async function handleSetUrl(id: string, url: string) {
    setItems((its) => its.map((i) => (i.id === id ? { ...i, url: url || null } : i)));
    await updateItemUrl(id, url);
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
    <div className="p-6">
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">时间轴</h1>
        <span className="rounded-full bg-accent px-3 py-0.5 text-sm font-medium text-accent-foreground">
          周期第 {week} 周
        </span>
        <span className="text-sm text-muted-foreground">{CYCLE_PHASES[week - 1]}</span>
        {periodOn && (
          <span className="rounded-full border border-pink-300 bg-pink-50 px-3 py-0.5 text-sm text-pink-700">
            🩸 经期中 · 已避开腹部
          </span>
        )}
        <div className="ml-auto flex overflow-hidden rounded-md border">
          {PLAN_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-1 text-sm transition-colors",
                tab === t ? "bg-primary text-primary-foreground" : "hover:bg-accent",
              )}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
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
          <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-sm text-muted-foreground">{formatDateCn(today)}</p>
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs"
              style={{ borderColor: "#e0484a55", color: "#e0484a", background: "#e0484a12" }}
              title="按当前时间自动定位到该做的领域"
            >
              <span className="size-1.5 rounded-full" style={{ background: "#e0484a" }} />
              现在 {String(Math.floor(nowMinutes() / 60)).padStart(2, "0")}:
              {String(nowMinutes() % 60).padStart(2, "0")} · 自动跟随
            </span>
            {/* 今日总进度：柱条 + 数字，一眼知道整天做了多少 */}
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
            {selected && selected !== autoKey && (
              <button
                className="text-sm text-primary hover:underline"
                onClick={() => setSelected(null)}
              >
                ← 回到此刻
              </button>
            )}
          </div>

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
            {/* 左：连线时间轴，点圆点切到那个时段。每站挂一条迷你进度条，
                所以「哪条线做完了、哪条还空着」不用点进去就看得见（方案 A）。 */}
            <div className="relative w-40 shrink-0 sm:w-44">
              <div className="absolute bottom-4 left-[9px] top-4 w-0.5 bg-border" />
              <div className="flex flex-col gap-10">
                {DOMAINS.map((d) => {
                  const isActive = d.key === activeKey;
                  const isPast = d.start <= nowMinutes();
                  const p = domainProgress(d);
                  const allDone = p.total > 0 && p.done === p.total;
                  return (
                    <div key={d.key}>
                      <button
                        onClick={() => setSelected(d.key)}
                        className="relative flex w-full items-start gap-3 rounded-md py-1 pr-1 text-left transition-colors hover:bg-accent/40"
                        style={isActive ? { background: d.tint } : undefined}
                        title={`${d.name} ${p.done}/${p.total}`}
                      >
                        <span
                          className="z-10 mt-0.5 shrink-0 rounded-full transition-all"
                          style={{
                            width: isActive ? 20 : 16,
                            height: isActive ? 20 : 16,
                            marginLeft: isActive ? -2 : 0,
                            background: isActive || isPast || allDone ? d.color : "var(--color-card)",
                            border: isActive || isPast || allDone ? "none" : `2px solid ${d.color}`,
                            boxShadow: isActive ? `0 0 0 5px ${d.tint}` : "none",
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-1.5">
                            <span
                              className="text-[15px]"
                              style={{ color: isActive ? d.textc : undefined, fontWeight: isActive ? 600 : 400 }}
                            >
                              {d.name}
                            </span>
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              {p.done}/{p.total}
                            </span>
                            {allDone && <span className="text-[11px] text-emerald-600">✓</span>}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {d.time}
                            {d.key === autoKey && " · 现在"}
                          </span>
                          <MiniBar done={p.done} total={p.total} color={d.color} />
                        </span>
                      </button>
                      {d.key === autoKey && (
                        <div className="my-2 ml-[-4px] border-t border-dashed border-red-400" />
                      )}
                    </div>
                  );
                })}
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

              {/* 按状态分栏（方案 C）：左＝今日计划（大卡片能写笔记），
                  右＝已完成／未完成。勾掉一条就从左边挪到右边，做完的不再挡着阅读动线。 */}
              <div className="grid gap-5" style={{ gridTemplateColumns: "minmax(0,1.55fr) minmax(240px,1fr)" }}>
                <div>
                  <ColHead label="今日计划" n={active.source === "todo" ? todoPending.length : curPending.length} />
                  <div className="space-y-3">
                    {active.source === "plan" &&
                      curPending.map((i) => (
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
                          onDelete={isSeedItem(i) ? undefined : () => handleDelete(i.id)}
                          onSetUrl={isSeedItem(i) ? undefined : (v) => handleSetUrl(i.id, v)}
                        />
                      ))}
                    {active.source === "todo" &&
                      todoPending.map((t) => (
                        <ThreeRowCard
                          key={t.id}
                          title={t.title}
                          detail={null}
                          url={null}
                          state="pending"
                          noteRequired={active.noteRequired}
                          notePlaceholder={placeholderFor(active)}
                          noteVal={notes[t.id] ?? ""}
                          onNote={(v) => saveNote(t.id, v)}
                          onDone={() => toggleWork(t)}
                          onSkip={() => {}}
                          onClear={() => toggleWork(t)}
                        />
                      ))}
                    {(active.source === "todo" ? todoPending.length : curPending.length) === 0 && (
                      <p className="py-8 text-sm text-muted-foreground">
                        {(active.source === "todo" ? todoCards.length : planCards.length) === 0
                          ? active.source === "todo"
                            ? "今天没有工作待办——上面加一条，或去待办把要做的点进今天。"
                            : "这个时段今天没有安排。"
                          : "这一段都处理完了 🎉"}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <ColHead label="已完成" n={active.source === "todo" ? todoDone.length : curDone.length} tone="ok" />
                    <div className="space-y-2">
                      {active.source === "plan" &&
                        curDone.map((i) => (
                          <DoneStrip
                            key={i.id}
                            title={i.title}
                            timeSlot={i.time_slot}
                            note={notes[i.id] ?? ""}
                            tone="ok"
                            onUndo={() => setStatus(i, null)}
                          />
                        ))}
                      {active.source === "todo" &&
                        todoDone.map((t) => (
                          <DoneStrip
                            key={t.id}
                            title={t.title}
                            timeSlot={null}
                            note={notes[t.id] ?? ""}
                            tone="ok"
                            onUndo={() => toggleWork(t)}
                          />
                        ))}
                      {(active.source === "todo" ? todoDone.length : curDone.length) === 0 && (
                        <p className="text-xs text-muted-foreground">还没有</p>
                      )}
                    </div>
                  </div>

                  {/* skip 单独一栏：主动决定不做，跟「还没做」不是一回事 */}
                  {active.source === "plan" && (
                    <div>
                      <ColHead label="未完成" n={curSkip.length} tone="skip" />
                      <div className="space-y-2">
                        {curSkip.map((i) => (
                          <DoneStrip
                            key={i.id}
                            title={i.title}
                            timeSlot={i.time_slot}
                            note={notes[i.id] ?? ""}
                            tone="skip"
                            onUndo={() => setStatus(i, null)}
                          />
                        ))}
                        {curSkip.length === 0 && <p className="text-xs text-muted-foreground">没有</p>}
                      </div>
                    </div>
                  )}
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

          <div className="overflow-hidden rounded-xl border bg-card">
            {DOMAINS.map((d) => {
              const p = domainProgress(d);
              const isNow = d.key === autoKey;
              const planRows = d.source === "plan" ? pendingFirst(domainItems(d, todays)) : [];
              const todoRows = d.source === "todo" ? todaysWorkTodos() : [];
              if (planRows.length === 0 && todoRows.length === 0) return null;
              return (
                <div key={d.key}>
                  <div
                    className="flex items-center gap-2 border-b px-3 py-1.5"
                    style={{ background: isNow ? d.tint : "var(--color-muted)" }}
                  >
                    <span className="size-2 shrink-0 rounded-full" style={{ background: d.color }} />
                    <span className="text-sm font-medium" style={{ color: d.textc }}>
                      {d.name}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">{d.time}</span>
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
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border-l-4 border-primary bg-accent p-4 text-sm leading-relaxed text-accent-foreground">
            {SEMESTER_TARGET}
          </div>
          {SEMESTER_PLAN.map((m) => (
            <section key={m.title} className="rounded-xl border bg-card p-4">
              <div className="mb-2 flex flex-wrap items-baseline gap-2">
                <h2 className="text-lg font-semibold">{m.title}</h2>
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
            const dayItems = shown.filter((i) => matchesDay(i, d));
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
                      onRename={(v) => handleRename(item.id, v)}
                      onDelete={isSeedItem(item) ? undefined : () => handleDelete(item.id)}
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
