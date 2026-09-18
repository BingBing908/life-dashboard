import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { PAGE } from "@/lib/ui";
import { addDays, mondayOf, todayStr } from "@/lib/dates";
import type { AppModule } from "../types";
import {
  applyPeriod,
  getPeriodOn,
  listCheckStatus,
  listItems,
  seedIfEmpty,
  type CheckStatus,
  type PlanItem,
} from "../study-plan/data";
import { Timetable } from "./Timetable";

/**
 * 「日程」独立模块（2026-09-18 从时间轴的 tab 拆出来，Rosie：「我是希望给
 * 一周时间线全览单开一个界面的」）。
 *
 * 页面＝**一周全览**（七列网格，每列一天的全部时段块）+ 点某天看当天明细表。
 * 数据仍然全部来自时间轴的 plan_items + 作息骨架（Timetable.tsx 里的 DAY_FRAME），
 * **这里只是另一个视图，不是另一份数据**——改作息还是去时间轴/seed.ts 改。
 */

function Card() {
  return <p className="text-sm text-muted-foreground">一周时间线全览 · 每天从早到晚一张表</p>;
}

function Page() {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [weekChecks, setWeekChecks] = useState<Record<string, Map<string, CheckStatus>>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      // seedIfEmpty：万一还没播种（或播种曾失败），进这页也能自愈
      await seedIfEmpty().catch(() => {});
      const [list, periodOn] = await Promise.all([listItems(), getPeriodOn()]);
      setItems(list.map((i) => applyPeriod(i, periodOn)).filter((i): i is PlanItem => i !== null));
      const mon = mondayOf(todayStr());
      const checks: Record<string, Map<string, CheckStatus>> = {};
      for (let d = 0; d < 7; d++) {
        const date = addDays(mon, d);
        checks[date] = await listCheckStatus(date);
      }
      setWeekChecks(checks);
    })()
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div className={PAGE}>
      <div className="mb-4 flex items-baseline gap-3">
        <h1 className="text-2xl font-semibold">日程</h1>
        <span className="text-sm text-muted-foreground">
          一周全览 · 实时来自时间轴的计划（改作息去时间轴改，这里自动跟着变）
        </span>
      </div>
      {loaded ? (
        <Timetable items={items} weekChecks={weekChecks} />
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
