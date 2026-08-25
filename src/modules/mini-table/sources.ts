import { addDays, mondayOf, todayStr } from "@/lib/dates";
import { dayCalories, getMeals, getWeightLog, listDrinks, listSnacks } from "../supplement/data";
import { listCheckStatus, listItems } from "../study-plan/data";
import { listTodos } from "../todo/data";
import { listAllEntries, type Entry } from "../study-log/data";
import { entryDone } from "../study-log";
import { isGraduated, isReviewable, reviewStage } from "../study-log/review";

/** 日日学里按天统计的学习板块（书籍/电影不是每日内容，不计） */
const LOG_BOARDS: [string, string][] = [
  ["english", "英语"],
  ["chinese", "语文"],
  ["ai", "AI"],
  ["history", "历史"],
  ["finance", "金融"],
  ["pm", "PM"],
];

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
    autoItems: ["空腹体重", "早餐", "午餐", "晚餐", "零食/饮品", "总摄入卡路里", "睡前体重"],
    async compute(weekDates) {
      const res: Record<string, Record<string, string>> = {
        空腹体重: {},
        早餐: {},
        午餐: {},
        晚餐: {},
        "零食/饮品": {},
        总摄入卡路里: {},
        睡前体重: {},
      };
      const weights = await getWeightLog();
      // 一次取够整周，再按天分组（别在循环里每天查一次库）
      const drinks = await listDrinks(weekDates[0]);
      const snacks = await listSnacks(weekDates[0]);
      for (let i = 0; i < 7; i++) {
        const date = weekDates[i];
        const col = DAY_COLS[i];
        const meals = await getMeals(date);
        const total = await dayCalories(date);
        res.早餐[col] = meals.早.content ?? "";
        res.午餐[col] = meals.午.content ?? "";
        res.晚餐[col] = meals.晚.content ?? "";
        // 「零食/饮品」＝当天的饮品和零食摘要 + 合计热量（总摄入那行已含它们，这行是拆开看）
        const dd = drinks.filter((d) => d.date === date);
        const ss = snacks.filter((s) => s.date === date);
        const parts = [
          ...dd.map((d) => [d.brand, d.name].filter(Boolean).join("") || d.subtype),
          ...ss.map((s) => s.name || s.subtype),
        ];
        const kcal = [...dd, ...ss].reduce((sum, r) => sum + (r.calories ?? 0), 0);
        res["零食/饮品"][col] = parts.length
          ? `${parts.join("、")}${kcal ? ` ${kcal}` : ""}`
          : "";
        res.总摄入卡路里[col] = total ? String(total) : "";
        res.空腹体重[col] = weights[date]?.am != null ? String(weights[date].am) : "";
        res.睡前体重[col] = weights[date]?.pm != null ? String(weights[date].pm) : "";
      }
      return res;
    },
  },
  // 时间轴周表：六条线 = 当天时间轴里点了「已完成」的条目（运动表格已并入这里）
  // 养生/英语/学习/运动/阅读 走 plan_checks；工作走 todos（当天 done_at）；
  // 日日学走 study_entries（当天各板块「看完/总数」，条目太多、列不下标题，给计数）
  "tbl-plan-week": {
    itemCol: "item",
    dayCols: DAY_COLS,
    autoItems: ["养生", "英语", "工作", "学习", "运动", "阅读", "日日学"],
    async compute(weekDates) {
      const items = await listItems();
      const todos = await listTodos();
      const logs = await listAllEntries();
      const res: Record<string, Record<string, string>> = {
        养生: {}, 英语: {}, 工作: {}, 学习: {}, 运动: {}, 阅读: {}, 日日学: {},
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
        res.日日学[col] = LOG_BOARDS.map(([key, label]) => {
          const day = logs.filter((e) => e.entry_date === date && e.board === key && e.kind !== "note");
          return day.length ? `${label}${day.filter(entryDone).length}/${day.length}` : "";
        })
          .filter(Boolean)
          .join(" ");
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

/* ══════════════════════════ 清单型表格（2026-08-21 加） ══════════════════════════
 *
 * Rosie 要一张「学习表格」：三列＝英语谚语 / 语文成语 / 古诗，点格子弹出释义，
 * 目的是「一眼看出来都学了什么」，且**每次更新自动新增**。
 *
 * ⚠️⚠️ **为什么必须另开一套机制，不能加一条 `TABLE_SOURCES`**：
 *   ① `TableDetail` 只渲染 `mini_table_rows` 里**真实存在的行**，`TABLE_SOURCES` 只是
 *      **覆盖已有行的格子值**。要「自动新增行」就得定期往库里写行 ⇒ 引入同步和重复风险
 *      （种子重复那个坑的同一类问题）。这里的数据源已经在 `study_entries` 里了，
 *      **再复制一份进 mini_table_rows 违反「不复制数据」**。
 *   ② 现有单元格只有四种编辑器，**没有「点开看详情」这种形态**。
 *
 * ⚠️ **而且它本质不是「表格」，是三个并排的清单**：第 3 条谚语和第 3 首古诗之间
 *   没有任何关系，而表格的「行」隐含「这一行的格子相关」。三列长度也不同
 *   （古诗 7 / 成语 6 / 谚语 5）。所以清单型表：**只读、行数＝最长那列、格子各自独立**。
 *
 * 好处：**零落库、零同步、自动增长**——每天注入新内容后，打开就多几行。
 */

/** 清单型表格的一个格子：正面显示 text（+ 可选 badge），点开显示 detail */
export interface ListCell {
  text: string;
  detail: string;
  /** 右上角小徽标，这里用来放复习进度（如 `3/5`、`✓`） */
  badge?: string;
  /** 学的那天，显示在弹窗里 */
  date?: string;
}

export interface ListSource {
  columns: { id: string; name: string; hint?: string }[];
  /** 说明行（表头下面那句话） */
  note?: string;
  compute: () => Promise<Record<string, ListCell[]>>;
}

/** 复习进度徽标：毕业＝✓，否则 `已过/5`；不进复习队列的内容不给徽标 */
function revBadge(e: Entry): string | undefined {
  if (!isReviewable(e)) return undefined;
  if (isGraduated(e)) return "✓";
  return `${reviewStage(e)}/5`;
}

/** 标题里 `·` 之后那截（「成语 · 青出于蓝」→「青出于蓝」）；没有 `·` 就用整个标题 */
function afterDot(title: string): string {
  const i = title.indexOf("·");
  return i >= 0 ? title.slice(i + 1).trim() : title.trim();
}

export const LIST_SOURCES: Record<string, ListSource> = {
  "tbl-learned": {
    note: "点任意一格看释义。内容实时来自日日学，每天更新后自动多出几行，不用手填。徽标＝复习进度（✓＝五次全过已毕业）。",
    columns: [
      { id: "proverb_en", name: "英语谚语", hint: "点开看中文释义" },
      { id: "idiom", name: "语文成语", hint: "点开看意思/出处/例句" },
      { id: "poem", name: "古诗", hint: "点开看原诗和白话" },
    ],
    async compute() {
      const all = await listAllEntries();
      // 都按 entry_date 升序＝学习顺序，新学的排在最下面（跟「每次更新新增进表格」一致）
      // ⚠️ Entry 的 entry_date / title / body 都是 `string | null`，一律兜住空值
      const dateKey = (e: Entry) => e.entry_date ?? "";
      const pick = (board: string, kind: string): Entry[] =>
        all
          .filter((e) => e.board === board && e.kind === kind)
          .sort((a, b) => (dateKey(a) < dateKey(b) ? -1 : dateKey(a) > dateKey(b) ? 1 : 0));
      const cell = (e: Entry, text: string): ListCell => ({
        text,
        detail: e.body ?? "",
        badge: revBadge(e),
        date: e.entry_date ?? undefined,
      });

      return {
        // 英语谚语：正面给英文那句（body 第一行），弹窗给全文（含中文释义）
        proverb_en: pick("english", "谚语").map((e) =>
          cell(e, (e.body ?? "").split("\n")[0].trim() || afterDot(e.title ?? "")),
        ),
        idiom: pick("chinese", "成语").map((e) => cell(e, afterDot(e.title ?? ""))),
        poem: pick("chinese", "古诗").map((e) => cell(e, afterDot(e.title ?? ""))),
      };
    },
  },
};
