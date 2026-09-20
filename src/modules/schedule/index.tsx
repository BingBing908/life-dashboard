import { useCallback, useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { PAGE } from "@/lib/ui";
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
import { listTodos, type Todo } from "../todo/data";
// 三餐互通（2026-09-20 Rosie）：周历里的三餐块显示饮食模块填的内容（早餐｜茶叶蛋+豆浆）
import { getMeals } from "../supplement/data";
import { Timetable } from "./Timetable";
import { EditorPanel } from "./Editor";

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

function Page() {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [weekChecks, setWeekChecks] = useState<Record<string, Map<string, CheckStatus>>>({});
  const [weekMeals, setWeekMeals] = useState<Record<string, Record<string, string>>>({});
  const [todayTodos, setTodayTodos] = useState<Todo[]>([]);
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
    // 「今天的待办」口径与总览/时间轴一致：标过今天（含逾期未完成），已完成的只留今天完成的
    setTodayTodos(
      todos.filter((t) => t.due_date && t.due_date <= today && (!t.done || (t.done_at ?? "").slice(0, 10) === today)),
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
          一周全览 · 和时间轴/待办同一份数据 · 点任意块可直接编辑
        </span>
      </div>
      {loaded ? (
        <>
          {outdated && (
            <div className="mb-3 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              作息模板有更新（晚间改版）——去<b>时间轴</b>页点顶部的「一键同步」就能换成新作息，这页会自动跟着变。
            </div>
          )}
          <Timetable
            items={items}
            weekChecks={weekChecks}
            weekMeals={weekMeals}
            todayTodos={todayTodos}
            onSelect={(sel, day) => setSelected({ ids: sel.map((i) => i.id), day })}
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
