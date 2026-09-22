import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PAGE } from "@/lib/ui";
import { useSubPath } from "@/lib/hashRoute";
import { addDays, mondayOf, todayStr } from "@/lib/dates";
import type { AppModule } from "../types";
import {
  applyPeriod,
  ensureSeedAdditions,
  getPeriodOn,
  getSeedVersion,
  latestSeedVersion,
  listAllItems,
  listCheckStatus,
  seedIfEmpty,
  type CheckStatus,
  type PlanItem,
} from "../study-plan/data";
import { isStaleStudyTodo, listTodos, type Todo } from "../todo/data";
// 三餐互通（2026-09-20 Rosie）：周历里的三餐块显示饮食模块填的内容（早餐｜茶叶蛋+豆浆）
import { getMeals } from "../supplement/data";
import { Timetable } from "./Timetable";
import { AddPanel, EditorPanel } from "./Editor";
// 路线 2026-09-20 从时间轴搬来（Rosie：时间轴只做一日简览，其余归日程）
import { RoadmapStages } from "../study-plan/RoadmapStages";
import { SEMESTER_TARGET } from "../study-plan/seed";

/**
 * 「日程」独立模块（2026-09-18 从时间轴的 tab 拆出来，Rosie：「我是希望给
 * 一周时间线全览单开一个界面的」）。
 *
 * 页面＝**一周全览**（F1 竖排周历）+ 点块直改的编辑区。
 * 数据＝时间轴的 plan_items 一份数据（含 track='frame' 的作息骨架，2026-09-19 起
 * 骨架也在库里、可编辑、走同步）+ 今天的待办（只读展示在「工作」块里）。
 * **这里是另一个视图 + 一个编辑入口，不是另一份数据。**
 */

function Card() {
  return <p className="text-sm text-muted-foreground">一周时间线全览 · 点任意块可直接编辑</p>;
}

const SCHEDULE_TABS = [
  { key: "week", label: "周视图" },
  { key: "roadmap", label: "路线" },
] as const;

function Page() {
  // tab 进 URL（铁律 3）：#/schedule＝周视图，#/schedule/roadmap＝路线
  const [sub, navSub] = useSubPath("schedule");
  const tab = sub[0] === "roadmap" ? "roadmap" : "week";
  const [items, setItems] = useState<PlanItem[]>([]);
  const [weekChecks, setWeekChecks] = useState<Record<string, Map<string, CheckStatus>>>({});
  const [weekMeals, setWeekMeals] = useState<Record<string, Record<string, string>>>({});
  const [todayTodos, setTodayTodos] = useState<Todo[]>([]);
  // 添加面板默认藏着（2026-09-20 Rosie）：＋ 按钮或双击周历空白处唤醒；空白处双击带预填时间
  const [addCtx, setAddCtx] = useState<{ slot?: string; days?: string } | null>(null);
  // day＝null ⇒ 编辑整条；day＝1..7 ⇒ 只改那一天（编辑区拆分）。
  // ⚠️ 存 id 不存对象（2026-09-20 Rosie：「三项都想改要改三遍」）——保存单项后面板不关，
  // 条目从最新 items 里按 id 现取，保存过的行自动变回「未改动」态，其余行的草稿原样留着。
  const [selected, setSelected] = useState<{ ids: string[]; day: number | null } | null>(null);
  const [outdated, setOutdated] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const today = todayStr();
    const [list, periodOn, todos] = await Promise.all([listAllItems(), getPeriodOn(), listTodos()]);
    setItems(list.map((i) => applyPeriod(i, periodOn)).filter((i): i is PlanItem => i !== null));
    // ⚠️⚠️ 工作块只放**工作**待办，学习类一律挡在外面（2026-09-22 Rosie 截图：
    // 周二工作块里混着「新概念学习／口语跟读／单词背诵」）。两道闸：
    //  ① `source === 'study'`——老复印件的标记；但**云端 todos 至今没有 source 列**，
    //     同步不上去，这道闸对已有数据基本失效；
    //  ② 按标题兜底：标题和任一学习计划条目（english/ai/cert）同名的，不进工作块。
    // 时间轴那边（study-plan 的 todaysWorkTodos）用的是同一套判断，改一处记得对一眼另一处。
    const studyTitles = new Set(
      list.filter((i) => i.track === "english" || i.track === "ai" || i.track === "cert").map((i) => i.title),
    );
    // 「今天的待办」口径与总览/时间轴一致：标过今天（含逾期未完成），已完成的只留今天完成的；
    // 学习类过期不顺延（isStaleStudyTodo）
    setTodayTodos(
      todos.filter(
        (t) =>
          t.due_date &&
          t.due_date <= today &&
          (!t.done || (t.done_at ?? "").slice(0, 10) === today) &&
          !isStaleStudyTodo(t, today) &&
          // 学习行已改为直接引用计划数据，老复印件（source='study'）不再进工作块
          t.source !== "study" &&
          !studyTitles.has(t.title),
      ),
    );
    const mon = mondayOf(today);
    const checks: Record<string, Map<string, CheckStatus>> = {};
    const meals: Record<string, Record<string, string>> = {};
    for (let d = 0; d < 7; d++) {
      const date = addDays(mon, d);
      checks[date] = await listCheckStatus(date);
      // 三餐互通：键＝骨架条目的标题（早餐/午餐/晚餐），值＝饮食里填的内容；没填是空串
      const m = await getMeals(date).catch(() => null);
      meals[date] = m
        ? { 早餐: m.早.content ?? "", 午餐: m.午.content ?? "", 晚餐: m.晚.content ?? "" }
        : {};
    }
    setWeekChecks(checks);
    setWeekMeals(meals);
  }, []);

  useEffect(() => {
    (async () => {
      // seedIfEmpty：万一还没播种（或播种曾失败），进这页也能自愈；
      // ensureSeedAdditions：模板纯新增的升级（如 v25 作息骨架）静默补齐，不动她的编辑
      await seedIfEmpty().catch(() => {});
      await ensureSeedAdditions().catch(() => {});
      // 修改型模板升级（SEED_RESET_BELOW 挡住增量补的那种）要她去时间轴点一键同步，这里提示
      setOutdated((await getSeedVersion().catch(() => 0)) < latestSeedVersion());
      await reload();
    })()
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [reload]);

  // 保存/删除/新增后只刷数据、不收面板——她要一口气改完一块里的好几项再点 X
  const onChanged = useCallback(() => {
    void reload();
  }, [reload]);

  const selectedItems = selected ? items.filter((i) => selected.ids.includes(i.id)) : null;

  return (
    <div className={PAGE}>
      <div className="mb-4 flex items-baseline gap-3">
        <h1 className="text-2xl font-semibold">日程</h1>
        <span className="text-sm text-muted-foreground">
          {tab === "roadmap"
            ? "冲刺 AI PM 的阶段路线（从时间轴搬来）"
            : "一周全览"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border">
            {SCHEDULE_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => navSub(t.key === "week" ? [] : [t.key])}
                className={cn(
                  "px-4 py-1 text-sm transition-colors",
                  tab === t.key ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab === "week" && (
            <Button
              variant={addCtx ? "secondary" : "outline"}
              size="icon-sm"
              title="添加新日程（也可以双击周历的空白处）"
              onClick={() => setAddCtx(addCtx ? null : {})}
            >
              <Plus className="size-4" />
            </Button>
          )}
        </div>
      </div>
      {tab === "roadmap" ? (
        <div className="space-y-4">
          {/* 阶段目标 + 她自己写「实际做了什么」；形态刻意不是预排周计划，理由在 roadmap.ts 顶部 */}
          <RoadmapStages />
          <div className="rounded-lg border-l-4 border-primary bg-accent p-4 text-sm leading-relaxed text-accent-foreground">
            {SEMESTER_TARGET}
          </div>
        </div>
      ) : loaded ? (
        <>
          {outdated && (
            <div className="mb-3 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              作息模板有更新（晚间改版）——去<b>时间轴</b>页点顶部的「一键同步」就能换成新作息，这页会自动跟着变。
            </div>
          )}
          {addCtx && (
            <AddPanel
              key={`${addCtx.slot ?? ""}|${addCtx.days ?? ""}`}
              initSlot={addCtx.slot}
              initDays={addCtx.days}
              onChanged={onChanged}
              onClose={() => setAddCtx(null)}
            />
          )}
          <Timetable
            items={items}
            weekChecks={weekChecks}
            weekMeals={weekMeals}
            todayTodos={todayTodos}
            onSelect={(sel, day) => setSelected({ ids: sel.map((i) => i.id), day })}
            onAddAt={(dayNum, slot) => setAddCtx({ slot, days: String(dayNum) })}
          />
          <EditorPanel
            selected={selectedItems}
            day={selected?.day ?? null}
            onChanged={onChanged}
            onClose={() => setSelected(null)}
          />
        </>
      ) : (
        <p className="py-8 text-sm text-muted-foreground">读取本周计划…</p>
      )}
    </div>
  );
}

const scheduleModule: AppModule = {
  manifest: {
    id: "schedule",
    name: "日程",
    icon: CalendarDays,
    description: "一周时间线全览",
    defaultSize: { w: 1, h: 1 },
  },
  Card,
  Page,
};

export default scheduleModule;
