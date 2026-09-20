import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { todayStr } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createItem,
  deleteItem,
  updateItemSlot,
  updateItemTitle,
  type PlanItem,
  type Track,
} from "../study-plan/data";
import { createTodo } from "../todo/data";

/**
 * 日程页的条目编辑区（2026-09-19，Rosie：「模块里允许自行填写内容，默认是你先行填进去的，
 * 但允许我做更改」）。周历里**双击**任意块 ⇒ 块里的计划条目在这里逐条改；
 * 键位（她定的）：**Enter＝保存，Ctrl+Enter＝在标题里换行**（换行会显示成块内的另一行）；
 * **删除＝条目框右上角的垃圾桶**，点第一下变红、再点确认。底部常驻「加一条」。
 * 写的都是 plan_items ⇒ 时间轴和云同步自动跟着变。
 *
 * ⚠️ 所有含输入框的组件都在顶层、草稿自持（study-plan 的失焦教训）；ItemRow 用 item.id 做 key，
 * 切换选中块时草稿自动重建。
 */

const DAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const ALL_DAYS = ["1", "2", "3", "4", "5", "6", "7"];
/** 条目实际覆盖哪几天（'*' 展开成 1-7） */
function daysOf(item: PlanItem): string[] {
  return item.days === "*" ? ALL_DAYS : item.days.split(",");
}

/** 「加一条」的类型（2026-09-19 Rosie 定的同步规则）：
 *  · 工作 ⇒ 只建**待办**（今天·重要紧急），它会出现在今天的「工作」块里——工作任务本来就归待办管；
 *  · AI/英语（＝学习）⇒ 建计划条目**并且**建一条今天·重要紧急的待办（她要求学习也同步到待办）；
 *  · 其余 ⇒ 只建计划条目。
 *  多行输入＝**一行一个事件**（Ctrl+Enter 换行），保存时逐行各成一条。 */
const ADD_CHOICES: { key: Track | "work"; name: string }[] = [
  { key: "work", name: "工作→待办" },
  { key: "ai", name: "AI 学习" },
  { key: "english", name: "英语" },
  { key: "sport", name: "运动" },
  { key: "wellness", name: "养生" },
  { key: "reading", name: "阅读" },
  { key: "frame", name: "作息骨架" },
];

/** 学习类新增行同步进待办（今天·重要紧急）——她定的：「待办仅同步工作和学习」 */
async function syncTodoIfStudy(track: Track, line: string): Promise<void> {
  if (track === "ai" || track === "english") await createTodo(line, "iu", todayStr(), 500);
}

function ItemRow({ item, day, onChanged }: { item: PlanItem; day: number | null; onChanged: () => void }) {
  const [title, setTitle] = useState(item.title);
  const [slot, setSlot] = useState(item.time_slot ?? "");
  const [days, setDays] = useState(item.days);
  const [confirmDel, setConfirmDel] = useState(false);
  const dirty = title !== item.title || slot !== (item.time_slot ?? "") || days !== item.days;
  // 单日模式下这条是不是「一周多天共用」的——是的话，改/删都要先把这一天拆出来
  const multi = day !== null && daysOf(item).length > 1 && daysOf(item).includes(String(day));

  const save = async () => {
    // 一行一个事件：第一行落在原条目上，后面每行各成一条新条目（同时段同类型）
    const lines = title.split("\n").map((s) => s.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const [first, ...rest] = lines;
    if (multi) {
      // 只改这一天：原条目去掉这天，这天按编辑后的内容单独成条（url 带上；detail/经期设置留在原条目）
      await updateItemSlot(item.id, item.time_slot ?? "", daysOf(item).filter((x) => x !== String(day)).join(","));
      await createItem(
        { track: item.track, days: String(day), time_slot: slot.trim() || null, title: first, url: item.url },
        item.sort_order,
      );
    } else {
      if (first !== item.title) await updateItemTitle(item.id, first);
      if (slot !== (item.time_slot ?? "") || days !== item.days) await updateItemSlot(item.id, slot, days);
    }
    for (const ln of rest) {
      await createItem(
        { track: item.track, days: multi ? String(day) : days.trim() || "*", time_slot: slot.trim() || null, title: ln },
        item.sort_order,
      );
      await syncTodoIfStudy(item.track, ln);
    }
    onChanged();
  };
  const del = async () => {
    if (!confirmDel) {
      setConfirmDel(true);
      return;
    }
    if (multi) {
      // 只删这一天＝从 days 里摘掉这天，条目本身和其他天不动
      await updateItemSlot(item.id, item.time_slot ?? "", daysOf(item).filter((x) => x !== String(day)).join(","));
    } else {
      await deleteItem(item.id);
    }
    onChanged();
  };

  return (
    <div className="relative rounded-xl border border-border/70 p-3 pr-10">
      <button
        onClick={del}
        onBlur={() => setConfirmDel(false)}
        title={confirmDel ? "再点一次确认删除" : multi ? `只删${DAY_NAMES[(day ?? 1) - 1]}这一天` : "删除这条"}
        className={cn(
          "absolute right-2 top-2 rounded-md p-1.5 transition-colors",
          confirmDel ? "bg-destructive/15 text-destructive" : "text-muted-foreground hover:text-destructive",
        )}
      >
        <Trash2 className="size-4" />
      </button>
      <div className="space-y-2">
        <Textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            // Enter 保存 / Ctrl+Enter 换行（textarea 默认行为是反的，这里对调；换行走 state 不直改 DOM）
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (e.ctrlKey) {
              const el = e.currentTarget;
              const s = el.selectionStart;
              setTitle(title.slice(0, s) + "\n" + title.slice(el.selectionEnd));
              requestAnimationFrame(() => {
                el.selectionStart = el.selectionEnd = s + 1;
              });
            } else {
              void save();
            }
          }}
          rows={Math.max(1, title.split("\n").length)}
          className="min-h-0 resize-none text-[15px]"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="06:10–06:30（留空＝无固定钟点）"
            className="w-60"
          />
          {multi ? (
            <span className="rounded-full bg-secondary px-3 py-1 text-[13px] text-secondary-foreground">
              只改{DAY_NAMES[(day ?? 1) - 1]}（保存后这天自动拆成单独一条）
            </span>
          ) : (
            <Input
              value={days}
              onChange={(e) => setDays(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="* 或 1,3,5"
              title="哪几天：* ＝每天；1,3,5 ＝周一三五（1=周一 … 7=周日）"
              className="w-28"
            />
          )}
          {dirty && (
            <Button size="sm" disabled={!title.trim()} onClick={save}>
              保存
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function AddForm({ onChanged }: { onChanged: () => void }) {
  const [track, setTrack] = useState<Track | "work">("ai");
  const [title, setTitle] = useState("");
  const [slot, setSlot] = useState("");
  const [days, setDays] = useState("*");

  const add = async () => {
    const lines = title.split("\n").map((s) => s.trim()).filter(Boolean);
    if (lines.length === 0) return;
    for (const ln of lines) {
      if (track === "work") {
        // 工作＝只进待办（今天·重要紧急）；它会出现在今天的「工作」块里
        await createTodo(ln, "iu", todayStr(), 500);
      } else {
        await createItem({ track, days: days.trim() || "*", time_slot: slot.trim() || null, title: ln }, 500);
        await syncTodoIfStudy(track, ln);
      }
    }
    setTitle("");
    setSlot("");
    onChanged();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {ADD_CHOICES.map((t) => (
          <button
            key={t.key}
            onClick={() => setTrack(t.key)}
            className={cn(
              "rounded-full px-3 py-1 text-[13px]",
              track === t.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
            )}
          >
            {t.name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-start gap-2">
        <Textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (e.ctrlKey) {
              const el = e.currentTarget;
              const s = el.selectionStart;
              setTitle(title.slice(0, s) + "\n" + title.slice(el.selectionEnd));
              requestAnimationFrame(() => {
                el.selectionStart = el.selectionEnd = s + 1;
              });
            } else {
              void add();
            }
          }}
          rows={Math.max(1, title.split("\n").length)}
          placeholder="要做的事（Enter 添加 · Ctrl+Enter 换行，一行一个事件）"
          className="min-h-0 min-w-40 flex-1 resize-none text-[15px]"
        />
        {track !== "work" && (
          <>
            <Input value={slot} onChange={(e) => setSlot(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="19:00–19:45（可留空）" className="w-60" />
            <Input value={days} onChange={(e) => setDays(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="* 或 1,3,5" className="w-28" />
          </>
        )}
        <Button size="sm" disabled={!title.trim()} onClick={add}>
          添加
        </Button>
      </div>
    </div>
  );
}

export function EditorPanel({
  selected,
  day,
  onChanged,
  onClose,
}: {
  /** null＝没选块，只显示「加一条」 */
  selected: PlanItem[] | null;
  /** null＝编辑整条（一周同款一起变）；1..7＝只改那一天（拆分模式） */
  day: number | null;
  onChanged: () => void;
  onClose: () => void;
}) {
  return (
    <div className="mt-4 space-y-3 rounded-2xl bg-card p-4">
      {selected && selected.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {day !== null
                ? `只改${DAY_NAMES[day - 1]}这一天（其他天不受影响）`
                : "编辑整条（一周同款一起变）"}
              {" · Enter 逐项保存（面板不关，可接着改下一项）· Ctrl+Enter 换行 · 垃圾桶删除点两次 · 全改完点右上 ✕ 收起"}
            </span>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground" title="收起">
              <X className="size-4" />
            </button>
          </div>
          {selected.map((it) => (
            <ItemRow key={`${it.id}-${day ?? "all"}`} item={it} day={day} onChanged={onChanged} />
          ))}
          <div className="border-t border-border/60" />
        </>
      )}
      <span className="block text-sm font-medium">加一条（选类型；一行一个事件，Ctrl+Enter 换行）</span>
      <AddForm onChanged={onChanged} />
      <p className="text-[13px] text-muted-foreground">
        这里写的直接进时间轴那份数据，云端自动同步；「工作→待办」和 AI/英语的新增会同时进待办（今天·重要紧急），
        在待办里打勾这里也跟着 ✓。星期写法：* ＝每天，1,3,5 ＝周一三五。
      </p>
    </div>
  );
}
