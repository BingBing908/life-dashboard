import { useCallback, useEffect, useState } from "react";
import { Clock, ExternalLink } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { todayStr } from "@/lib/dates";
import type { AppModule } from "../types";
import {
  applyPeriod,
  dayNumOf,
  getPeriodOn,
  listChecks,
  listNotes,
  matchesDay,
  seedIfEmpty,
  setNote,
  toggleCheck,
  type PlanItem,
} from "../study-plan/data";
import { listTodos, toggleTodo, type Todo } from "../todo/data";

interface Domain {
  key: string;
  name: string;
  start: number; // 当天分钟数（用于按时间自动定位）
  time: string;
  color: string;
  tint: string;
  textc: string;
  source: "plan" | "todo";
  tracks?: string[];
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

async function openLink(url: string) {
  if ("__TAURI_INTERNALS__" in window) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      return;
    } catch {
      /* fallthrough */
    }
  }
  window.open(url, "_blank", "noopener");
}

function Card() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const d = DOMAINS.find((x) => x.key === autoDomainKey())!;
    const now = new Date();
    setText(`现在 ${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")} · ${d.name}`);
  }, []);
  return <p className="text-sm text-muted-foreground">{text ?? "加载中…"}</p>;
}

function Page() {
  const today = todayStr();
  const todayNum = dayNumOf(today);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [checks, setChecks] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [todos, setTodos] = useState<Todo[]>([]);
  const [periodOn, setPeriodOn] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(() => {
    seedIfEmpty().then(setPlanItems);
    listChecks(today).then(setChecks);
    listNotes(today).then((m) => setNotes(Object.fromEntries(m)));
    listTodos().then(setTodos);
    getPeriodOn().then(setPeriodOn);
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  const autoKey = autoDomainKey();
  const activeKey = selected ?? autoKey;
  const active = DOMAINS.find((d) => d.key === activeKey)!;
  const now = new Date();

  // 当前领域的条目
  let planCards: PlanItem[] = [];
  let todoCards: Todo[] = [];
  if (active.source === "plan") {
    planCards = planItems
      .filter((i) => matchesDay(i, todayNum) && active.tracks!.includes(i.track))
      .map((i) => applyPeriod(i, periodOn))
      .filter((i): i is PlanItem => i !== null);
  } else {
    todoCards = todos.filter((t) => !t.done && t.due_date && t.due_date <= today);
  }

  function saveNote(id: string, v: string) {
    setNotes((s) => ({ ...s, [id]: v }));
    setNote(id, today, v);
  }

  async function togglePlan(item: PlanItem) {
    const checked = await toggleCheck(item.id, today);
    setChecks((prev) => {
      const n = new Set(prev);
      if (checked) n.add(item.id);
      else n.delete(item.id);
      return n;
    });
  }
  async function toggleWork(t: Todo) {
    setTodos((ts) => ts.map((x) => (x.id === t.id ? { ...x, done: x.done ? 0 : 1 } : x)));
    await toggleTodo(t.id, !t.done);
  }

  /** 三行小框 */
  function ThreeRowCard({
    id,
    title,
    url,
    done,
    onToggle,
  }: {
    id: string;
    title: string;
    url: string | null;
    done: boolean;
    onToggle: () => void;
  }) {
    const noteVal = notes[id] ?? "";
    const canCheck = !active.noteRequired || done || noteVal.trim().length > 0;
    return (
      <div className={cn("rounded-xl border bg-card p-3.5", done && "opacity-60")}>
        {/* 第一行：要做的事 + 跳转 */}
        <div className="flex items-center gap-2.5">
          <Checkbox
            checked={done}
            disabled={!canCheck}
            onCheckedChange={() => canCheck && onToggle()}
            className="size-5"
          />
          <span className={cn("min-w-0 flex-1 text-[15px] font-medium", done && "line-through")}>{title}</span>
          {url && (
            <button
              onClick={() => openLink(url)}
              title="打开"
              className="flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1 text-sm text-primary hover:bg-accent"
            >
              <ExternalLink className="size-4" /> 打开
            </button>
          )}
        </div>
        {/* 第二行：网址 */}
        {url && (
          <button
            onClick={() => openLink(url)}
            className="mt-1.5 block max-w-full truncate text-left text-xs text-primary/80 hover:underline"
          >
            {url}
          </button>
        )}
        {/* 第三行：我做了什么 */}
        <input
          value={noteVal}
          onChange={(e) => saveNote(id, e.target.value)}
          placeholder={done ? "已完成" : active.noteRequired ? "我具体做了什么？（写了才能打勾）" : "我做了什么（选填）"}
          className="mt-2 h-8 w-full rounded-md border bg-background px-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/40"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-3 flex items-center gap-2">
        <h1 className="text-2xl font-semibold">此刻</h1>
        <span className="text-sm text-muted-foreground">
          现在 {now.getHours()}:{String(now.getMinutes()).padStart(2, "0")}
          {selected && selected !== autoKey && "（手动查看）"}
        </span>
        {selected && selected !== autoKey && (
          <button className="text-sm text-primary hover:underline" onClick={() => setSelected(null)}>
            回到此刻
          </button>
        )}
      </div>

      <div className="flex gap-5">
        {/* 左：B2 连线时间轴 */}
        <div className="relative w-32 shrink-0">
          <div className="absolute bottom-2 left-[7px] top-2 w-0.5 bg-border" />
          <div className="flex flex-col gap-3.5">
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
                      className="z-10 shrink-0 rounded-full"
                      style={{
                        width: isActive ? 16 : 14,
                        height: isActive ? 16 : 14,
                        marginLeft: isActive ? -1 : 0,
                        background: isActive || isPast ? d.color : "var(--surface-2)",
                        border: isActive || isPast ? "none" : `2px solid ${d.color}`,
                        boxShadow: isActive ? `0 0 0 4px ${d.tint}` : "none",
                      }}
                    />
                    <span>
                      <span
                        className="block text-sm"
                        style={{ color: isActive ? d.textc : undefined, fontWeight: isActive ? 500 : 400 }}
                      >
                        {d.name}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {d.time}
                        {d.key === autoKey && " · 现在"}
                      </span>
                    </span>
                  </button>
                  {d.key === autoKey && (
                    <div className="my-1 ml-[-4px] border-t border-dashed border-red-400" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 右：当前领域内容 */}
        <div className="min-w-0 flex-1 border-l pl-5">
          <div className="mb-3 flex items-baseline gap-2">
            <span className="text-lg font-semibold" style={{ color: active.textc }}>{active.name}</span>
            <span className="text-xs text-muted-foreground">
              {active.source === "todo" ? "今天要做的（来自待办）" : ""}
            </span>
          </div>
          <div className="space-y-2.5">
            {active.source === "plan" &&
              planCards.map((i) => (
                <ThreeRowCard
                  key={i.id}
                  id={i.id}
                  title={i.title}
                  url={i.url}
                  done={checks.has(i.id)}
                  onToggle={() => togglePlan(i)}
                />
              ))}
            {active.source === "todo" &&
              todoCards.map((t) => (
                <ThreeRowCard
                  key={t.id}
                  id={t.id}
                  title={t.title}
                  url={null}
                  done={!!t.done}
                  onToggle={() => toggleWork(t)}
                />
              ))}
            {((active.source === "plan" && planCards.length === 0) ||
              (active.source === "todo" && todoCards.length === 0)) && (
              <p className="py-8 text-sm text-muted-foreground">
                {active.source === "todo"
                  ? "今天没有安排到「今天」的待办——去待办把要做的点进今天。"
                  : "这个时段今天没有安排。"}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const focusModule: AppModule = {
  manifest: {
    id: "focus",
    name: "此刻",
    icon: Clock,
    description: "按时间自动切到当下该做的事",
    defaultSize: { w: 2, h: 1 },
  },
  Card,
  Page,
};

export default focusModule;
