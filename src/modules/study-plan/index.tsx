import { useEffect, useState } from "react";
import { CalendarCheck, ExternalLink, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DoneToggle, type PlanState } from "@/components/DoneToggle";
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
import { addDays, formatDateCn, todayStr } from "@/lib/dates";
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
  setPeriodOn,
  toggleCheck,
  TRACKS,
  updateItemTitle,
  type CheckStatus,
  type PlanItem,
  type Track,
} from "./data";
import { listTodos, toggleTodo, type Todo } from "../todo/data";
import { SEMESTER_PLAN, SEMESTER_TARGET } from "./seed";

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
}

const DOMAINS: Domain[] = [
  { key: "wellness", name: "养生", start: 370, time: "6:10", color: "#1D9E75", tint: "#E1F5EE", textc: "#0F6E56", source: "plan", tracks: ["wellness"], noteRequired: false },
  { key: "english", name: "英语", start: 450, time: "7:30", color: "#378ADD", tint: "#E6F1FB", textc: "#0C447C", source: "plan", tracks: ["english"], noteRequired: true },
  { key: "work", name: "工作", start: 560, time: "9:20", color: "#888780", tint: "#F1EFE8", textc: "#5F5E5A", source: "todo", noteRequired: true },
  { key: "study", name: "学习", start: 1140, time: "19:00", color: "#7F77DD", tint: "#EEEDFE", textc: "#534AB7", source: "plan", tracks: ["cert", "ai"], noteRequired: true },
  { key: "sport", name: "运动", start: 1180, time: "19:40", color: "#639922", tint: "#EAF3DE", textc: "#3B6D11", source: "plan", tracks: ["sport"], noteRequired: false },
  { key: "reading", name: "阅读", start: 1260, time: "21:00", color: "#D4537E", tint: "#FBEAF0", textc: "#993556", source: "plan", tracks: ["reading"], noteRequired: true },
];

function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
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

function Page() {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [checkMap, setCheckMap] = useState<Map<string, CheckStatus>>(new Map());
  const [cycleStart, setCycleStart] = useState<string | null>(null);
  const [tab, setTab] = useState<"today" | "week" | "roadmap">("today");
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

  useEffect(() => {
    seedIfEmpty().then(setItems);
    listCheckStatus(today).then(setCheckMap);
    getCycleStart().then(setCycleStart);
    getSeedVersion().then((v) => setSeedOutdated(v < latestSeedVersion()));
    getPeriodOn().then(setPeriodState);
    listNotes(today).then((m) => setNotes(Object.fromEntries(m)));
    listTodos().then(setTodos);
    listChecks(yesterday).then(setYChecks);
  }, [today, yesterday]);

  async function togglePeriod() {
    const next = !periodOn;
    setPeriodState(next);
    await setPeriodOn(next);
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
  const planCards =
    active.source === "plan"
      ? pendingFirst(todays.filter((i) => active.tracks!.includes(i.track)))
      : [];
  const todoCards =
    active.source === "todo"
      ? todos.filter((t) => !t.done && t.due_date && t.due_date <= today)
      : [];

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

  function ItemRow({
    item,
    withCheck,
    hideTag = false,
  }: {
    item: PlanItem;
    withCheck: boolean;
    hideTag?: boolean;
  }) {
    const st = stateOf(item.id);
    const done = st === "done";
    const decided = st !== "pending";
    // 英语/学习/阅读：写了「做了什么」才允许打勾
    const needsNote =
      item.track === "english" ||
      item.track === "cert" ||
      item.track === "ai" ||
      item.track === "reading";
    const noteVal = notes[item.id] ?? "";
    const canCheck = !needsNote || done || noteVal.trim().length > 0;
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
              state={st}
              canComplete={canCheck}
              onDone={() => setStatus(item, "done")}
              onSkip={() => setStatus(item, "skip")}
              onClear={() => setStatus(item, null)}
              size="sm"
              disabledHint="先写「做了什么」才能标记完成"
            />
          )}
          <span className="w-28 shrink-0 text-sm text-muted-foreground">{item.time_slot}</span>
          {!hideTag && <TrackTag t={item.track} />}
          <div className="min-w-0 flex-1">
            <EditableText
              value={item.title}
              onSave={(v) => handleRename(item.id, v)}
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
          <button
            className="invisible shrink-0 text-muted-foreground hover:text-destructive group-hover:visible"
            title="删除"
            onClick={() => handleDelete(item.id)}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
        {showNote && (
          <input
            value={noteVal}
            onChange={(e) => {
              const v = e.target.value;
              setNotes((s) => ({ ...s, [item.id]: v }));
              setNote(item.id, today, v);
            }}
            placeholder={done ? "已完成" : notePlaceholder + "（写了才能打勾）"}
            className="mt-2 h-8 w-full rounded-md border bg-background px-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/40"
          />
        )}
      </div>
    );
  }

  /** 今天视图的大卡片：勾选+标题+打开 / 详细解释 / 网址 / 我做了什么 */
  function ThreeRowCard({
    id,
    title,
    timeSlot,
    detail,
    url,
    state,
    noteRequired,
    notePlaceholder,
    onDone,
    onSkip,
    onClear,
  }: {
    id: string;
    title: string;
    timeSlot?: string | null;
    detail: string | null;
    url: string | null;
    state: PlanState;
    noteRequired: boolean;
    notePlaceholder: string;
    onDone: () => void;
    onSkip: () => void;
    onClear: () => void;
  }) {
    const done = state === "done";
    const decided = state !== "pending";
    const noteVal = notes[id] ?? "";
    const canCheck = !noteRequired || done || noteVal.trim().length > 0;
    return (
      <div className={cn("rounded-xl border bg-card p-4", decided && "opacity-60")}>
        {/* 第一行：明细时间 + 要做的事 + 跳转 + 完成状态 */}
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
              title="打开"
              className="flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-primary hover:bg-accent"
            >
              <ExternalLink className="size-4" /> 打开
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
        </div>
        {/* 第二行：详细解释 */}
        {detail && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{detail}</p>
        )}
        {/* 第三行：网址 */}
        {url && (
          <button
            onClick={() => openLink(url)}
            className="mt-1.5 block max-w-full truncate text-left text-xs text-primary/80 hover:underline"
          >
            {url}
          </button>
        )}
        {/* 第四行：我做了什么 */}
        <input
          value={noteVal}
          onChange={(e) => saveNote(id, e.target.value)}
          placeholder={done ? "已完成" : noteRequired ? notePlaceholder + "（写了才能打勾）" : "我做了什么（选填）"}
          className="mt-2.5 h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary/40"
        />
      </div>
    );
  }

  /** 领域内条目的「我做了什么」提示语 */
  function placeholderFor(active: Domain, track?: Track): string {
    if (active.source === "todo") return "我具体做了什么？";
    if (track === "reading") return "看到哪本书的哪里？如：《她对此感到厌烦》第3章";
    if (track === "english") return "今天做了什么？如：刷完001";
    return "看了哪个视频 / 做了什么？";
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">学练计划</h1>
        <span className="rounded-full bg-accent px-3 py-0.5 text-sm font-medium text-accent-foreground">
          周期第 {week} 周
        </span>
        <span className="text-sm text-muted-foreground">{CYCLE_PHASES[week - 1]}</span>
        <button
          onClick={togglePeriod}
          title="经期模式：打开后自动隐藏/替换腹部相关内容"
          className={cn(
            "ml-auto rounded-full border px-3 py-1 text-sm transition-colors",
            periodOn
              ? "border-pink-300 bg-pink-50 text-pink-700"
              : "text-muted-foreground hover:bg-accent",
          )}
        >
          🩸 经期{periodOn ? "中·已避开腹部" : "模式"}
        </button>
        <div className="flex overflow-hidden rounded-md border">
          {(["today", "week", "roadmap"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-1 text-sm transition-colors",
                tab === t ? "bg-primary text-primary-foreground" : "hover:bg-accent",
              )}
            >
              {t === "today" ? "今天" : t === "week" ? "一周" : "路线"}
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
      {tab === "today" ? (
        <>
          <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-sm text-muted-foreground">
              {formatDateCn(today)} · 完成 {doneCount}/{todays.length}
            </p>
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
            {/* 左：连线时间轴，点圆点切到那个时段 */}
            <div className="relative w-32 shrink-0 sm:w-36">
              <div className="absolute bottom-4 left-[9px] top-4 w-0.5 bg-border" />
              <div className="flex flex-col gap-9">
                {DOMAINS.map((d) => {
                  const isActive = d.key === activeKey;
                  const isPast = d.start <= nowMinutes();
                  return (
                    <div key={d.key}>
                      <button
                        onClick={() => setSelected(d.key)}
                        className="relative flex w-full items-center gap-3 text-left"
                      >
                        <span
                          className="z-10 shrink-0 rounded-full transition-all"
                          style={{
                            width: isActive ? 20 : 16,
                            height: isActive ? 20 : 16,
                            marginLeft: isActive ? -2 : 0,
                            background: isActive || isPast ? d.color : "var(--surface-2)",
                            border: isActive || isPast ? "none" : `2px solid ${d.color}`,
                            boxShadow: isActive ? `0 0 0 5px ${d.tint}` : "none",
                          }}
                        />
                        <span>
                          <span
                            className="block text-[15px]"
                            style={{ color: isActive ? d.textc : undefined, fontWeight: isActive ? 600 : 400 }}
                          >
                            {d.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {d.time}
                            {d.key === autoKey && " · 现在"}
                          </span>
                        </span>
                      </button>
                      {d.key === autoKey && (
                        <div className="my-2.5 ml-[-4px] border-t border-dashed border-red-400" />
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
              <div className="space-y-3">
                {active.source === "plan" &&
                  planCards.map((i) => (
                    <ThreeRowCard
                      key={i.id}
                      id={i.id}
                      title={i.title}
                      timeSlot={i.time_slot}
                      detail={i.detail}
                      url={i.url}
                      state={stateOf(i.id)}
                      noteRequired={active.noteRequired}
                      notePlaceholder={placeholderFor(active, i.track)}
                      onDone={() => setStatus(i, "done")}
                      onSkip={() => setStatus(i, "skip")}
                      onClear={() => setStatus(i, null)}
                    />
                  ))}
                {active.source === "todo" &&
                  todoCards.map((t) => (
                    <ThreeRowCard
                      key={t.id}
                      id={t.id}
                      title={t.title}
                      detail={null}
                      url={null}
                      state={t.done ? "done" : "pending"}
                      noteRequired={active.noteRequired}
                      notePlaceholder={placeholderFor(active)}
                      onDone={() => toggleWork(t)}
                      onSkip={() => {}}
                      onClear={() => toggleWork(t)}
                    />
                  ))}
                {((active.source === "plan" && planCards.length === 0) ||
                  (active.source === "todo" && todoCards.length === 0)) && (
                  <p className="py-10 text-sm text-muted-foreground">
                    {active.source === "todo"
                      ? "今天没有安排到「今天」的待办——去待办把要做的点进今天。"
                      : "这个时段今天没有安排。"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
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
          {[1, 2, 3, 4, 5, 6, 7].map((d) => {
            const dayItems = shown.filter((i) => matchesDay(i, d));
            return (
              <section key={d}>
                <h2
                  className={cn(
                    "mb-1.5 text-sm font-semibold",
                    d === todayNum ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {DAY_NAMES[d]}
                  {d === todayNum && "（今天）"}
                </h2>
                <div className="space-y-1.5">
                  {dayItems.map((item) => (
                    <ItemRow key={`${d}-${item.id}`} item={item} withCheck={d === todayNum} />
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
    name: "学练计划",
    icon: CalendarCheck,
    description: "运动/英语/HCIP/AI/阅读 五线周计划",
    defaultSize: { w: 2, h: 1 },
  },
  Card,
  Page,
};

export default studyPlanModule;
