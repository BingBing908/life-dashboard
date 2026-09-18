import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
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

const TRACK_CHOICES: { key: Track; name: string }[] = [
  { key: "ai", name: "AI 学习" },
  { key: "english", name: "英语" },
  { key: "sport", name: "运动" },
  { key: "wellness", name: "养生" },
  { key: "reading", name: "阅读" },
  { key: "frame", name: "作息骨架" },
];

function ItemRow({ item, onChanged }: { item: PlanItem; onChanged: () => void }) {
  const [title, setTitle] = useState(item.title);
  const [slot, setSlot] = useState(item.time_slot ?? "");
  const [days, setDays] = useState(item.days);
  const [confirmDel, setConfirmDel] = useState(false);
  const dirty = title !== item.title || slot !== (item.time_slot ?? "") || days !== item.days;

  const save = async () => {
    if (!title.trim()) return;
    if (title !== item.title) await updateItemTitle(item.id, title.trim());
    if (slot !== (item.time_slot ?? "") || days !== item.days) await updateItemSlot(item.id, slot, days);
    onChanged();
  };
  const del = async () => {
    if (!confirmDel) {
      setConfirmDel(true);
      return;
    }
    await deleteItem(item.id);
    onChanged();
  };

  return (
    <div className="relative rounded-xl border border-border/70 p-3 pr-10">
      <button
        onClick={del}
        onBlur={() => setConfirmDel(false)}
        title={confirmDel ? "再点一次确认删除" : "删除这条"}
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
          <Input
            value={days}
            onChange={(e) => setDays(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="* 或 1,3,5"
            title="哪几天：* ＝每天；1,3,5 ＝周一三五（1=周一 … 7=周日）"
            className="w-28"
          />
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
  const [track, setTrack] = useState<Track>("ai");
  const [title, setTitle] = useState("");
  const [slot, setSlot] = useState("");
  const [days, setDays] = useState("*");

  const add = async () => {
    if (!title.trim()) return;
    await createItem({ track, days: days.trim() || "*", time_slot: slot.trim() || null, title: title.trim() }, 500);
    setTitle("");
    setSlot("");
    onChanged();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {TRACK_CHOICES.map((t) => (
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
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="条目名称（Enter 添加）"
          className="min-w-40 flex-1"
        />
        <Input value={slot} onChange={(e) => setSlot(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="19:00–19:45（可留空）" className="w-60" />
        <Input value={days} onChange={(e) => setDays(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="* 或 1,3,5" className="w-28" />
        <Button size="sm" disabled={!title.trim()} onClick={add}>
          添加
        </Button>
      </div>
    </div>
  );
}

export function EditorPanel({
  selected,
  onChanged,
  onClose,
}: {
  /** null＝没双击块，只显示「加一条」 */
  selected: PlanItem[] | null;
  onChanged: () => void;
  onClose: () => void;
}) {
  return (
    <div className="mt-4 space-y-3 rounded-2xl bg-card p-4">
      {selected && selected.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              编辑这一块 · Enter 保存 · Ctrl+Enter 换行 · 右上角垃圾桶删除（点两次确认）
            </span>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground" title="收起">
              <X className="size-4" />
            </button>
          </div>
          {selected.map((it) => (
            <ItemRow key={it.id} item={it} onChanged={onChanged} />
          ))}
          <div className="border-t border-border/60" />
        </>
      )}
      <span className="block text-sm font-medium">加一条（选类型；作息骨架＝不打卡的背景块）</span>
      <AddForm onChanged={onChanged} />
      <p className="text-[13px] text-muted-foreground">
        这里改的就是时间轴那份数据，两边和云端自动同步。星期写法：* ＝每天，1,3,5 ＝周一三五。
      </p>
    </div>
  );
}
