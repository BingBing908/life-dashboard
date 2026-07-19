import { useEffect, useState } from "react";
import { CalendarCheck, ExternalLink, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatDateCn, todayStr } from "@/lib/dates";
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
  listItems,
  listNotes,
  matchesDay,
  resetToSeed,
  seedIfEmpty,
  setNote,
  setPeriodOn,
  toggleCheck,
  TRACKS,
  updateItemTitle,
  type PlanItem,
  type Track,
} from "./data";
import { SEMESTER_PLAN, SEMESTER_TARGET } from "./seed";

const TRACK_STYLE: Record<Track, { bg: string; text: string; dot: string }> = {
  wellness: { bg: "bg-teal-50",    text: "text-teal-800",    dot: "bg-teal-500" },
  sport:    { bg: "bg-emerald-50", text: "text-emerald-800", dot: "bg-emerald-500" },
  english:  { bg: "bg-blue-50",    text: "text-blue-800",    dot: "bg-blue-500" },
  cert:     { bg: "bg-violet-50",  text: "text-violet-800",  dot: "bg-violet-500" },
  ai:       { bg: "bg-amber-50",   text: "text-amber-800",   dot: "bg-amber-500" },
  reading:  { bg: "bg-pink-50",    text: "text-pink-800",    dot: "bg-pink-500" },
};

/** 今日视图的板块分组（养生置顶，其余按时间早晚：英语→学习→运动→阅读） */
const SECTIONS: { name: string; hint: string; tracks: Track[] }[] = [
  { name: "养生", hint: "揉腹 · 八段锦 · 睡前拉伸", tracks: ["wellness"] },
  { name: "英语", hint: "听说为主", tracks: ["english"] },
  { name: "学习", hint: "HCIP + AI", tracks: ["cert", "ai"] },
  { name: "运动", hint: "康复 + 训练", tracks: ["sport"] },
  { name: "阅读", hint: "泡脚伴读", tracks: ["reading"] },
];

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

/** 打开跟练视频：Tauri 里用系统浏览器，网页里开新标签 */
async function openLink(url: string) {
  if ("__TAURI_INTERNALS__" in window) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      return;
    } catch {
      // 权限不足等情况回退到 window.open
    }
  }
  window.open(url, "_blank", "noopener");
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
  const [checks, setChecks] = useState<Set<string>>(new Set());
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

  useEffect(() => {
    seedIfEmpty().then(setItems);
    listChecks(today).then(setChecks);
    getCycleStart().then(setCycleStart);
    getSeedVersion().then((v) => setSeedOutdated(v < latestSeedVersion()));
    getPeriodOn().then(setPeriodState);
    listNotes(today).then((m) => setNotes(Object.fromEntries(m)));
  }, [today]);

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
      setChecks(new Set());
      setSeedOutdated(false);
    }
  }

  const week = cycleStart ? cycleWeekOf(cycleStart, today) : 1;
  const todays = shown.filter((i) => matchesDay(i, todayNum));
  const doneCount = todays.filter((i) => checks.has(i.id)).length;

  async function handleToggle(item: PlanItem) {
    const checked = await toggleCheck(item.id, today);
    setChecks((prev) => {
      const next = new Set(prev);
      if (checked) next.add(item.id);
      else next.delete(item.id);
      return next;
    });
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
    const done = checks.has(item.id);
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
      <div className={cn("group rounded-lg border px-4 py-3.5", withCheck && done && "opacity-60")}>
        <div className="flex items-center gap-3.5">
          {withCheck && (
            <Checkbox
              checked={done}
              disabled={!canCheck}
              onCheckedChange={() => canCheck && handleToggle(item)}
              className="size-6"
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
          <p className="mb-4 text-sm text-muted-foreground">
            {formatDateCn(today)} · 完成 {doneCount}/{todays.length}
          </p>
          {(() => {
            /** 养生板块用的迷你卡（方案C）：时间在上，勾选+标题在下，宽度自适应 */
            const MiniCard = ({ item }: { item: PlanItem }) => {
              const done = checks.has(item.id);
              return (
                <div
                  title={item.detail ?? undefined}
                  className={cn("rounded-lg border px-3 py-2", done && "opacity-60")}
                >
                  <div className="flex items-center text-xs text-muted-foreground">
                    {item.time_slot}
                    {item.url && (
                      <button
                        className="ml-auto text-primary hover:opacity-70"
                        title="打开跟练视频"
                        onClick={() => openLink(item.url!)}
                      >
                        <ExternalLink className="size-4" />
                      </button>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Checkbox
                      checked={done}
                      onCheckedChange={() => handleToggle(item)}
                      className="size-5"
                    />
                    <EditableText
                      value={item.title}
                      onSave={(v) => handleRename(item.id, v)}
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm font-medium",
                        done && "text-muted-foreground line-through",
                      )}
                      inputClassName="w-full text-sm"
                    />
                  </div>
                </div>
              );
            };

            const renderSection = (sec: (typeof SECTIONS)[number]) => {
              const secItems = todays.filter((i) => sec.tracks.includes(i.track));
              if (secItems.length === 0) return null;
              const secDone = secItems.filter((i) => checks.has(i.id)).length;
              const wellness = sec.tracks[0] === "wellness";
              const dot = TRACK_STYLE[sec.tracks[0]].dot;
              return (
                <section key={sec.name} className="rounded-xl border bg-card p-4">
                  <div className="mb-2.5 flex items-baseline gap-2">
                    <span className={cn("size-2.5 self-center rounded-full", dot)} />
                    <h2 className="text-base font-semibold">{sec.name}</h2>
                    <span className="text-xs text-muted-foreground">{sec.hint}</span>
                    <span
                      className={cn(
                        "ml-auto text-sm",
                        secDone === secItems.length
                          ? "font-medium text-primary"
                          : "text-muted-foreground",
                      )}
                    >
                      {secDone === secItems.length ? "✓ 完成" : `${secDone}/${secItems.length}`}
                    </span>
                  </div>
                  {wellness ? (
                    <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
                      {secItems.map((item) => (
                        <MiniCard key={item.id} item={item} />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {secItems.map((item) => (
                        <ItemRow
                          key={item.id}
                          item={item}
                          withCheck
                          hideTag={sec.tracks.length === 1}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            };
            return (
              <div className="space-y-4">
                {/* 养生横条（迷你卡网格）+ 四象限（运动/英语 上，学习/阅读 下） */}
                {renderSection(SECTIONS[0])}
                <div className="grid items-start gap-4 lg:grid-cols-2">
                  {SECTIONS.slice(1).map(renderSection)}
                </div>
              </div>
            );
          })()}
          {todays.length === 0 && (
            <p className="py-8 text-muted-foreground">今天没有安排，休息也是计划的一部分。</p>
          )}
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
