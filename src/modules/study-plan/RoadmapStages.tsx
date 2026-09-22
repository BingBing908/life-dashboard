import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CARD, CARD_TITLE } from "@/lib/ui";
import { getRoadmapMarks, setRoadmapMark, type RoadmapMark } from "./data";
import { ROADMAP_STAGES, ROADMAP_THREADS, type RoadmapStage } from "./roadmap";

/**
 * 冲刺路线（阶段目标 + 进度指针），渲染在「路线」tab 顶部。
 *
 * 每个阶段一张卡：左边是计划（目标 + 达标判据，来自 roadmap.ts 的常量），
 * 右边是她的部分——状态（未开始/进行中/已完成）+「实际做了什么」的记录框。
 * 这就是她要的「有计划，允许我在计划后写入我实际做了什么」。
 *
 * ⚠️ 记录框走**显式提交**，不是 onBlur 自动存——「会打半截的输入要显式提交」
 * 那条铁律（三餐那次的教训：自动存的半截内容会经同步盖掉好数据）。
 * ⚠️ 草稿只取一次初值 ⇒ 调用方必须等 marks 读完才渲染（`loaded` 门控），
 * 否则草稿定格成空、一提交就把她写过的记录清空——三餐上线当天踩过的同一个坑。
 */

const STATUS_OPTS: { v: RoadmapMark["status"]; label: string; cls: string }[] = [
  { v: "", label: "未开始", cls: "border text-muted-foreground" },
  { v: "active", label: "进行中", cls: "bg-blue-500 text-white" },
  { v: "done", label: "已完成", cls: "bg-emerald-500 text-white" },
];

/** 一个阶段的卡片。含 textarea ⇒ 必须在模块顶层定义（失焦那条铁律） */
function StageCard({
  stage,
  mark,
  onStatus,
  onSaveNote,
}: {
  stage: RoadmapStage;
  mark: RoadmapMark;
  onStatus: (v: RoadmapMark["status"]) => void;
  onSaveNote: (text: string) => void;
}) {
  // 草稿自持，不跟 props 同步（同 MealRow：同步会冲掉正在打的字）
  const [draft, setDraft] = useState(mark.note);
  const dirty = draft.trim() !== mark.note.trim();
  const st = mark.status;

  return (
    <section
      className={cn(
        CARD,
        st === "done" && "opacity-70",
        st === "active" && "border-blue-300",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className={CARD_TITLE}>{stage.title}</h2>
        <span className="text-sm text-muted-foreground">{stage.period}</span>
        <div className="ml-auto flex gap-1.5">
          {STATUS_OPTS.map((o) => (
            <button
              key={o.label}
              onClick={() => onStatus(o.v)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs transition-colors",
                st === o.v ? o.cls : "border text-muted-foreground hover:bg-accent",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-2 space-y-1 text-sm text-foreground/85">
        {stage.goals.map((g) => (
          <li key={g} className="flex gap-1.5">
            <span className="shrink-0 text-muted-foreground">·</span>
            <span>{g}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        <b className="text-foreground/70">达标判据：</b>
        {stage.done}
      </p>

      {/* 她的部分：实际做了什么（显式提交） */}
      <div className="mt-3 rounded-lg bg-muted px-3 py-2.5">
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">我实际做了什么</p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="随手记：看到哪了、做了什么、卡在哪……（点保存才写入）"
          className="min-h-16 w-full resize-y rounded-md border bg-card px-3 py-2 text-sm leading-relaxed outline-none focus:ring-1 focus:ring-primary/40"
        />
        <div className="mt-1.5 flex items-center justify-end gap-2">
          {dirty && <span className="text-xs text-amber-600">有未保存的改动</span>}
          <Button size="sm" variant={dirty ? "default" : "outline"} onClick={() => onSaveNote(draft.trim())}>
            {dirty ? "保存" : "已保存 ✓"}
          </Button>
        </div>
      </div>
    </section>
  );
}

export function RoadmapStages() {
  const [marks, setMarks] = useState<Record<string, RoadmapMark> | null>(null);

  useEffect(() => {
    getRoadmapMarks().then(setMarks).catch(() => setMarks({}));
  }, []);

  async function saveStatus(id: string, v: RoadmapMark["status"]) {
    setMarks((m) => ({ ...(m ?? {}), [id]: { note: m?.[id]?.note ?? "", status: v } }));
    await setRoadmapMark(id, "status", v);
  }
  async function saveNote(id: string, text: string) {
    setMarks((m) => ({ ...(m ?? {}), [id]: { note: text, status: m?.[id]?.status ?? "" } }));
    await setRoadmapMark(id, "note", text);
  }

  // ⚠️ 草稿只取一次初值 ⇒ 必须等读完再渲染，否则她已写的记录会被空草稿顶掉（三餐那个坑）
  if (marks === null) {
    return <p className="py-4 text-sm text-muted-foreground">读取冲刺路线…</p>;
  }

  const doneCount = ROADMAP_STAGES.filter((s) => marks[s.id]?.status === "done").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-xl font-semibold">冲刺 AI PM · 阶段路线</h2>
        <span className="text-sm text-muted-foreground">
          目标 2027 年 3–4 月面试 · {doneCount}/{ROADMAP_STAGES.length} 阶段完成
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          时间范围是指引不是死线——按进度走，做完一个阶段再进下一个
        </span>
      </div>
      {/* 贯穿主线：不属于某个阶段、每个阶段都在做的三件事（见 roadmap.ts ROADMAP_THREADS 的由来） */}
      <section className={cn(CARD, "border-blue-200 bg-blue-50/40")}>
        <h3 className="text-sm font-semibold text-foreground/80">贯穿全程的三条主线</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">不分阶段——每个阶段都要一直做的事</p>
        <ul className="mt-2 space-y-2">
          {ROADMAP_THREADS.map((t, i) => (
            <li key={t.title} className="text-sm">
              <span className="mr-1.5 font-medium text-primary">{i + 1}. {t.title}</span>
              <span className="text-foreground/80">{t.body}</span>
            </li>
          ))}
        </ul>
      </section>
      {ROADMAP_STAGES.map((s) => (
        <StageCard
          key={s.id}
          stage={s}
          mark={marks[s.id] ?? { note: "", status: "" }}
          onStatus={(v) => saveStatus(s.id, v)}
          onSaveNote={(t) => saveNote(s.id, t)}
        />
      ))}
    </div>
  );
}
