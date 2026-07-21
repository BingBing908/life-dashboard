import { addDays, mondayOf, todayStr } from "@/lib/dates";
import { dayCalories, getMeals } from "../supplement/data";
import { listCheckStatus, listItems } from "../study-plan/data";
import { listTodos } from "../todo/data";

/**
 * 小表格「数据源绑定」：按**表 id**把某张表的部分行接到其它模块的数据上，实现自动填。
 * - 靠表 id 绑定（不靠行名，改名不断）；数据不复制、每次打开实时算；用户手填的行照旧存 mini_table_rows。
 * - 新增绑定：给对应表 id 加一条即可（如将来的「学习表格」）。
 */
export interface TableSource {
  /** 标签列 id（行的「项目」列） */
  itemCol: string;
  /** 周一..周日 的列 id（顺序对应本周一到周日） */
  dayCols: string[];
  /** 这些「项目」行的日列自动填（其余行仍手填） */
  autoItems: string[];
  /** 算出 { [项目]: { [列id]: 值 } } */
  compute: (weekDates: string[]) => Promise<Record<string, Record<string, string>>>;
}

const DAY_COLS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const TABLE_SOURCES: Record<string, TableSource> = {
  // 三餐表格：早/午/晚 + 总卡路里 来自饮食（meal_log）；空腹/睡前体重手填
  "tbl-meals-week": {
    itemCol: "item",
    dayCols: DAY_COLS,
    autoItems: ["早餐", "午餐", "晚餐", "总摄入卡路里"],
    async compute(weekDates) {
      const res: Record<string, Record<string, string>> = {
        早餐: {},
        午餐: {},
        晚餐: {},
        总摄入卡路里: {},
      };
      for (let i = 0; i < 7; i++) {
        const date = weekDates[i];
        const col = DAY_COLS[i];
        const meals = await getMeals(date);
        const total = await dayCalories(date);
        res.早餐[col] = meals.早.content ?? "";
        res.午餐[col] = meals.午.content ?? "";
        res.晚餐[col] = meals.晚.content ?? "";
        res.总摄入卡路里[col] = total ? String(total) : "";
      }
      return res;
    },
  },
  // 时间轴周表：六条线 = 当天时间轴里点了「已完成」的条目（运动表格已并入这里）
  // 养生/英语/学习/运动/阅读 走 plan_checks；工作走 todos（当天 done_at）
  "tbl-plan-week": {
    itemCol: "item",
    dayCols: DAY_COLS,
    autoItems: ["养生", "英语", "工作", "学习", "运动", "阅读"],
    async compute(weekDates) {
      const items = await listItems();
      const todos = await listTodos();
      const res: Record<string, Record<string, string>> = {
        养生: {}, 英语: {}, 工作: {}, 学习: {}, 运动: {}, 阅读: {},
      };
      for (let i = 0; i < 7; i++) {
        const date = weekDates[i];
        const col = DAY_COLS[i];
        const status = await listCheckStatus(date);
        const done = (...tracks: string[]) =>
          items
            .filter((it) => tracks.includes(it.track) && status.get(it.id) === "done")
            .map((it) => it.title)
            .join("、");
        res.养生[col] = done("wellness");
        res.英语[col] = done("english");
        res.学习[col] = done("cert", "ai");
        res.运动[col] = done("sport");
        res.阅读[col] = done("reading");
        res.工作[col] = todos
          .filter((t) => t.done && (t.done_at ?? "").slice(0, 10) === date)
          .map((t) => t.title)
          .join("、");
      }
      return res;
    },
  },
};

/** 本周一~周日的日期（供 compute 用） */
export function currentWeekDates(): string[] {
  const mon = mondayOf(todayStr());
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}
