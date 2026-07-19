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
  createItem,
  CYCLE_PHASES,
  cycleWeekOf,
  dayNumOf,
  deleteItem,
  getCycleStart,
  listChecks,
  listItems,
  matchesDay,
  seedIfEmpty,
  toggleCheck,
  TRACKS,
  updateItemTitle,
  type PlanItem,
  type Track,
} from "./data";

const TRACK_STYLE: Record<Track, { bg: string; text: string; dot: string }> = {
  sport:   { bg: "bg-emerald-50", text: "text-emerald-800", dot: "bg-emerald-500" },
  english: { bg: "bg-blue-50",    text: "text-blue-800",    dot: "bg-blue-500" },
  cert:    { bg: "bg-violet-50",  text: "text-violet-800",  dot: "bg-violet-500" },
  ai:      { bg: "bg-amber-50",   text: "text-amber-800",   dot: "bg-amber-500" },
  reading: { bg: "bg-pink-50",    text: "text-pink-800",    dot: "bg-pink-500" },
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
  const [tab, setTab] = useState<"today" | "week">("today");
  const [newDay, setNewDay] = useState("*");
  const [newTrack, setNewTrack] = useState<Track>("sport");
  const [newTime, setNewTime] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const today = todayStr();
  const todayNum = dayNumOf(today);

  useEffect(() => {
    seedIfEmpty().then(setItems);
    listChecks(today).then(setChecks);
    getCycleStart().then(setCycleStart);
  }, [today]);

  const week = cycleStart ? cycleWeekOf(cycleStart, today) : 1;
  const todays = items.filter((i) => matchesDay(i, todayNum));
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

  function ItemRow({ item, withCheck }: { item: PlanItem; withCheck: boolean }) {
    const done = checks.has(item.id);
    return (
      <div
        className={cn(
          "group flex items-center gap-2.5 rounded-md border px-3 py-2",
          withCheck && done && "opacity-60",
        )}
      >
        {withCheck && (
          <Checkbox checked={done} onCheckedChange={() => handleToggle(item)} className="size-5" />
        )}
        <span className="w-24 shrink-0 text-xs text-muted-foreground">{item.time_slot}</span>
        <TrackTag t={item.track} />
        <div className="min-w-0 flex-1">
          <EditableText
            value={item.title}
            onSave={(v) => handleRename(item.id, v)}
            className={cn("block truncate text-sm", withCheck && done && "line-through")}
            inputClassName="w-full text-sm"
          />
          {item.detail && (
            <p className="truncate text-xs text-muted-foreground" title={item.detail}>
              {item.detail}
            </p>
          )}
        </div>
        {item.url && (
          <button
            className="flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs text-primary hover:bg-accent"
            title="打开跟练视频"
            onClick={() => openLink(item.url!)}
          >
            <ExternalLink className="size-3.5" /> 跟练
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
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">学练计划</h1>
        <span className="rounded-full bg-accent px-3 py-0.5 text-sm font-medium text-accent-foreground">
          周期第 {week} 周
        </span>
        <span className="text-sm text-muted-foreground">{CYCLE_PHASES[week - 1]}</span>
        <div className="ml-auto flex overflow-hidden rounded-md border">
          {(["today", "week"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-1 text-sm transition-colors",
                tab === t ? "bg-primary text-primary-foreground" : "hover:bg-accent",
              )}
            >
              {t === "today" ? "今天" : "一周"}
            </button>
          ))}
        </div>
      </div>

      {tab === "today" ? (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {formatDateCn(today)} · 完成 {doneCount}/{todays.length}
          </p>
          <div className="space-y-1.5">
            {todays.map((item) => (
              <ItemRow key={item.id} item={item} withCheck />
            ))}
          </div>
          {todays.length === 0 && (
            <p className="py-8 text-muted-foreground">今天没有安排，休息也是计划的一部分。</p>
          )}
        </>
      ) : (
        <div className="mt-4 space-y-6">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => {
            const dayItems = items.filter((i) => matchesDay(i, d));
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
