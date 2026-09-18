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
  const [todayTodos, setTodayTodos] = useState<Todo[]>([]);
  const [selected, setSelected] = useState<PlanItem[] | null>(null);
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
    for (let d = 0; d < 7; d++) {
      const date = addDays(mon, d);
      checks[date] = await listCheckStatus(date);
    }
    setWeekChecks(checks);
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

  const onChanged = useCallback(() => {
    setSelected(null);
    void reload();
  }, [reload]);

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
          <Timetable items={items} weekChecks={weekChecks} todayTodos={todayTodos} onSelect={setSelected} />
          <EditorPanel selected={selected} onChanged={onChanged} onClose={() => setSelected(null)} />
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
