import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { addDays, toDateStr, todayStr } from "@/lib/dates";
import type { AppModule } from "../types";
import { dayNumOf, getPeriodOn } from "../study-plan/data";
import {
  deleteTreat,
  getCalTarget,
  getMeals,
  getWeightLog,
  listDrinks,
  listSnacks,
  logDrink,
  logSnack,
  setCalTarget,
  setMeal,
  setWeightEntry,
  SNACK_SUBTYPES,
  type Drink,
  type DrinkSubtype,
  type MealKey,
  type Snack,
  type SnackSubtype,
} from "./data";

/** 基础代谢（Mifflin-St Jeor，女 164cm/68kg/24岁，往低估）；低于它有掉发风险 */
const BMR = 1420;

/** 1=周一 … 7=周日；按 Rosie 作息表的补剂安排 */
const SCHEDULE: Record<number, { morning: string[]; noon: string[]; evening: string[] }> = {
  1: { morning: ["维D"],           noon: ["鱼油", "辅酶Q10"], evening: ["小红镁"] },
  2: { morning: [],                noon: ["鱼油", "辅酶Q10"], evening: ["钙镁锌"] },
  3: { morning: ["复合维B", "维C"], noon: ["鱼油", "辅酶Q10"], evening: ["小红镁"] },
  4: { morning: [],                noon: ["鱼油", "辅酶Q10"], evening: ["钙镁锌"] },
  5: { morning: ["复合维B", "维C"], noon: ["鱼油", "辅酶Q10"], evening: ["小红镁"] },
  6: { morning: [],                noon: ["鱼油", "辅酶Q10"], evening: [] },
  7: { morning: ["复合维B", "维C"], noon: ["鱼油", "辅酶Q10"], evening: [] },
};
const DAY_NAMES = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"];

const MEALS: { key: MealKey; label: string; cook: string; takeout: string }[] = [
  {
    key: "早",
    label: "早餐",
    cook: "水煮蛋 2 个 + 无糖燕麦牛奶 + 一小把莓果 / 一个苹果",
    takeout: "便利店：茶叶蛋 + 无糖豆浆 + 水煮玉米",
  },
  {
    key: "午",
    label: "午餐",
    cook: "鸡胸 / 虾 + 糙米饭一拳 + 清炒时蔬两拳",
    takeout: "轻食沙拉（油醋汁减半）/ 清汤麻辣烫（多菜 + 鸡胸豆腐，免麻酱油碟）",
  },
  {
    key: "晚",
    label: "晚餐",
    cook: "清蒸鱼 / 豆腐 + 大量绿叶菜，主食减半或不吃",
    takeout: "关东煮（萝卜 / 海带 / 豆腐 / 蛋，少丸子）/ 白灼虾鸡 + 焯青菜",
  },
];

/** 经期饮食建议：经期开关打开时显示在三餐区顶部（水肿是水不是脂肪，别靠饿减） */
const PERIOD_MEAL_TIPS: string[] = [
  "体重涨 1–2kg 是经期存水，不是长胖——结束后几天自己掉回来，别焦虑。",
  "热量守在基代 1420、别再少吃：水肿靠饿减不掉，只会掉肌肉和头发。",
  "少盐少酱：钠让身体存更多水，肿得更明显。",
  "多喝温水：喝够反而帮排水，别不敢喝。",
  "多蛋白 + 含钾食物（香蕉 / 菠菜 / 土豆）帮平衡水分。",
  "适量红肉 / 动物肝补铁（经期失血），配维C 吸收更好。",
  "这几天先别每天称重，等经期结束再看空腹体重趋势。",
];

const SUBTYPES: DrinkSubtype[] = ["奶茶", "果茶", "酸奶"];
const SUGARS = ["无糖", "三分糖", "五分糖", "七分糖", "全糖"];
const DRINK_COLOR: Record<DrinkSubtype, { dot: string; chip: string }> = {
  奶茶: { dot: "bg-red-500", chip: "bg-red-50 text-red-700" },
  果茶: { dot: "bg-green-500", chip: "bg-green-50 text-green-700" },
  酸奶: { dot: "bg-violet-500", chip: "bg-violet-50 text-violet-700" },
};

/**
 * 体重两格：**前晚睡前** + **今晨空腹**（2026-07-29 Rosie 要求，放在补剂上面）。
 *
 * 这两个数配成一对是有讲究的：它们之间的差＝**一夜之间的变化**，
 * 主要是排水和排空，比「今天 vs 昨天同一时刻」更能看出前一天吃咸没吃咸。
 * ⚠️ 存的还是同一个体重库（`app_settings` 的 `weight:<date>:am|pm`），
 * 所以跟总览、跟小表格三餐周表是同一份数据——「前晚睡前」写的是**昨天的 pm**，
 * 今晚在总览填的睡前，明天就变成这里的「前晚」。别再另存一份。
 */
function WeightPair({
  lastNight,
  thisMorning,
  onSave,
}: {
  lastNight: string;
  thisMorning: string;
  onSave: (which: "lastPm" | "todayAm", v: string) => void;
}) {
  const [pm, setPm] = useState(lastNight);
  const [am, setAm] = useState(thisMorning);
  // 外部数据（云同步拉到的）变了要跟上
  useEffect(() => setPm(lastNight), [lastNight]);
  useEffect(() => setAm(thisMorning), [thisMorning]);

  const a = Number(am);
  const p = Number(pm);
  const delta = am !== "" && pm !== "" && isFinite(a) && isFinite(p) ? a - p : null;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold">体重</h2>
        {delta !== null && (
          <span className="text-sm text-muted-foreground">
            一夜{delta <= 0 ? "掉了 " : "涨了 "}
            <b className={delta <= 0 ? "text-emerald-600" : "text-amber-600"}>
              {Math.abs(delta).toFixed(1)}kg
            </b>
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-1 items-center gap-2 text-sm">
          <span className="shrink-0 text-muted-foreground">前晚睡前</span>
          <Input
            type="number"
            step="0.1"
            value={pm}
            onChange={(e) => setPm(e.target.value)}
            onBlur={(e) => onSave("lastPm", e.target.value)}
            placeholder="kg"
            className="w-20"
          />
        </label>
        <label className="flex flex-1 items-center gap-2 text-sm">
          <span className="shrink-0 text-muted-foreground">今晨空腹</span>
          <Input
            type="number"
            step="0.1"
            value={am}
            onChange={(e) => setAm(e.target.value)}
            onBlur={(e) => onSave("todayAm", e.target.value)}
            placeholder="kg"
            className="w-20"
          />
        </label>
      </div>
    </div>
  );
}

/** 「记到 X／回到今天」那一行——饮品和零食两个表单共用（同一个 drinkDate，点一次日历两边都跟着走） */
function DateLine({
  date,
  today,
  onBackToToday,
}: {
  date: string;
  today: string;
  onBackToToday: () => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">记到</span>
      <span className={cn("font-medium", date !== today && "text-amber-600")}>
        {date === today ? "今天" : `${date.slice(5)} 补记`}
      </span>
      {date !== today && (
        <button className="text-xs text-primary hover:underline" onClick={onBackToToday}>
          回到今天
        </button>
      )}
      <span className="ml-auto text-[11px] text-muted-foreground">↓ 点下方日历选别的天</span>
    </div>
  );
}

/** 已记的一条（饮品/零食共用，删除也共用 deleteTreat） */
function TreatRow({
  dot,
  text,
  calories,
  onDelete,
}: {
  dot: string;
  text: string;
  calories: number | null;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
      <span className={cn("size-2 shrink-0 rounded-full", dot)} />
      <span className="min-w-0 flex-1 truncate">{text}</span>
      <span className="shrink-0 text-muted-foreground">
        {calories != null ? `${calories} kcal` : "热量待算"}
      </span>
      <button
        className="invisible shrink-0 text-muted-foreground hover:text-destructive group-hover:visible"
        title="删掉这条"
        onClick={onDelete}
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

function Slot({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-6 shrink-0 text-xs text-muted-foreground">{label}</span>
      {items.length ? (
        <span className="text-sm">{items.join(" · ")}</span>
      ) : (
        <span className="text-sm text-muted-foreground/60">无</span>
      )}
    </div>
  );
}

function Card() {
  const [periodOn, setPeriodOn] = useState(false);
  useEffect(() => {
    getPeriodOn().then(setPeriodOn).catch(() => {});
  }, []);
  if (periodOn) {
    return <p className="text-xs text-pink-700">🩸 经期：无需进食补剂</p>;
  }
  const s = SCHEDULE[dayNumOf(todayStr())];
  return (
    <div className="space-y-1.5">
      <Slot label="早" items={s.morning} />
      <Slot label="午" items={s.noon} />
      <Slot label="晚" items={s.evening} />
    </div>
  );
}

/** 饮品/零食月历：有饮品的日子按品类填色（奶茶红/果茶绿/酸奶紫），
 *  只有零食没饮品的日子用琥珀色描边（跟填色区分开，一格能同时表达两件事）；
 *  点某天＝选中它补记（今天及以前可点，饮品和零食都记到这一天） */
function DrinkCalendar({
  drinks,
  snacks,
  selected,
  onSelect,
  className,
}: {
  drinks: Drink[];
  snacks: Snack[];
  selected: string;
  onSelect: (d: string) => void;
  /** 让调用方把它变成「吸收本栏剩余高度」的那张卡（传 flex-1） */
  className?: string;
}) {
  const today = todayStr();
  const [ym, setYm] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() + 1 };
  });

  const byDate = new Map<string, Set<DrinkSubtype>>();
  for (const d of drinks) {
    if (!byDate.has(d.date)) byDate.set(d.date, new Set());
    byDate.get(d.date)!.add(d.subtype);
  }
  const colorOf = (date: string): string | null => {
    const set = byDate.get(date);
    if (!set) return null;
    if (set.has("奶茶")) return "bg-red-500";
    if (set.has("果茶")) return "bg-green-500";
    return "bg-violet-500";
  };
  const snackDays = new Set(snacks.map((s) => s.date));

  const first = new Date(ym.y, ym.m - 1, 1);
  const lead = (first.getDay() + 6) % 7; // 周一开头
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  const daysInMonth = new Date(ym.y, ym.m, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) cells.push(toDateStr(new Date(ym.y, ym.m - 1, d)));

  function shift(n: number) {
    const d = new Date(ym.y, ym.m - 1 + n, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() + 1 });
  }

  return (
    <div className={cn("rounded-xl border bg-card p-4", className)}>
      <div className="mb-1 flex items-center">
        <span className="text-sm font-medium">
          {ym.y}年{ym.m}月
        </span>
        <span className="ml-auto flex">
          <button className="rounded p-0.5 text-muted-foreground hover:bg-accent" onClick={() => shift(-1)}>
            <ChevronLeft className="size-4" />
          </button>
          <button className="rounded p-0.5 text-muted-foreground hover:bg-accent" onClick={() => shift(1)}>
            <ChevronRight className="size-4" />
          </button>
        </span>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {["一", "二", "三", "四", "五", "六", "日"].map((w) => (
          <span key={w} className="text-[10px] text-muted-foreground">{w}</span>
        ))}
        {cells.map((date, i) => {
          if (!date) return <span key={`x${i}`} />;
          const day = Number(date.slice(8));
          const color = colorOf(date);
          const hasSnack = snackDays.has(date);
          const isSel = date === selected;
          const future = date > today;
          const marks = [color && "饮品", hasSnack && "零食"].filter(Boolean).join(" + ");
          return (
            <div key={date} className="flex justify-center">
              <button
                disabled={future}
                onClick={() => onSelect(date)}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[11px] transition-all",
                  color ? color + " text-white" : "text-foreground",
                  // 只有零食没饮品：琥珀描边（内描边，不跟选中的 ring 抢位置）
                  hasSnack && !color && "shadow-[inset_0_0_0_1.5px_var(--color-amber-500)] text-amber-700",
                  hasSnack && color && "shadow-[inset_0_0_0_1.5px_#fff8]",
                  future ? "cursor-not-allowed opacity-30" : "hover:ring-1 hover:ring-primary/50",
                  date === today && !color && !hasSnack && !isSel && "ring-1 ring-primary",
                  isSel && "ring-2 ring-primary ring-offset-1",
                )}
                title={
                  future
                    ? `${date}（未来不能记）`
                    : `${date}${marks ? `：${marks}` : ""}（点这天补记）`
                }
              >
                {day}
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-center text-[10px] text-muted-foreground">点某天可补记那天的饮品/零食</p>
      <div className="mt-1.5 flex flex-wrap justify-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
        <span><span className="mr-0.5 inline-block size-2 rounded-full bg-red-500 align-middle" />奶茶</span>
        <span><span className="mr-0.5 inline-block size-2 rounded-full bg-green-500 align-middle" />果茶</span>
        <span><span className="mr-0.5 inline-block size-2 rounded-full bg-violet-500 align-middle" />酸奶</span>
        <span><span className="mr-0.5 inline-block size-2 rounded-full align-middle shadow-[inset_0_0_0_1.5px_var(--color-amber-500)]" />零食</span>
      </div>
    </div>
  );
}

function Page() {
  const today = todayStr();
  const todayNum = dayNumOf(todayStr());
  const [periodOn, setPeriodOn] = useState(false);
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [snacks, setSnacks] = useState<Snack[]>([]);
  const [calTarget, setCalTargetState] = useState(1400);
  // 体重两格：前晚睡前（昨天的 pm）+ 今晨空腹（今天的 am），走同一个体重库
  const yesterday = addDays(today, -1);
  const [wLastPm, setWLastPm] = useState("");
  const [wTodayAm, setWTodayAm] = useState("");
  const [meals, setMeals] = useState<Record<MealKey, { content: string; calories: string }>>({
    早: { content: "", calories: "" },
    午: { content: "", calories: "" },
    晚: { content: "", calories: "" },
  });

  // 记一杯 表单
  const [dSub, setDSub] = useState<DrinkSubtype>("奶茶");
  const [dBrand, setDBrand] = useState("");
  const [dName, setDName] = useState("");
  const [dSugar, setDSugar] = useState("五分糖");
  const [dCal, setDCal] = useState("");
  const [drinkDate, setDrinkDate] = useState(today); // 记到哪天（点日历改，默认今天）

  // 记一笔零食 表单（跟饮品共用 drinkDate，所以点一次日历两边都补记到那天）
  const [sSub, setSSub] = useState<SnackSubtype>("坚果");
  const [sName, setSName] = useState("");
  const [sCal, setSCal] = useState("");

  const reloadTreats = useCallback(() => {
    const since = toDateStr(new Date(Date.now() - 100 * 864e5));
    listDrinks(since).then(setDrinks).catch(() => {});
    listSnacks(since).then(setSnacks).catch(() => {});
  }, []);

  useEffect(() => {
    getPeriodOn().then(setPeriodOn).catch(() => {});
    getCalTarget().then(setCalTargetState).catch(() => {});
    getWeightLog()
      .then((w) => {
        setWLastPm(w[yesterday]?.pm != null ? String(w[yesterday].pm) : "");
        setWTodayAm(w[today]?.am != null ? String(w[today].am) : "");
      })
      .catch(() => {});
    reloadTreats();
    getMeals(today).then((m) => {
      setMeals({
        早: { content: m.早.content ?? "", calories: m.早.calories?.toString() ?? "" },
        午: { content: m.午.content ?? "", calories: m.午.calories?.toString() ?? "" },
        晚: { content: m.晚.content ?? "", calories: m.晚.calories?.toString() ?? "" },
      });
    });
  }, [today, yesterday, reloadTreats]);

  /** 存体重：前晚睡前写昨天的 pm，今晨空腹写今天的 am（同一个体重库，别另存） */
  async function saveWeight(which: "lastPm" | "todayAm", str: string) {
    const v = str.trim() === "" ? null : Number(str);
    if (v != null && !isFinite(v)) return;
    if (which === "lastPm") {
      setWLastPm(str);
      await setWeightEntry(yesterday, "pm", v);
    } else {
      setWTodayAm(str);
      await setWeightEntry(today, "am", v);
    }
  }

  async function addDrink() {
    await logDrink({
      subtype: dSub,
      brand: dBrand.trim() || undefined,
      name: dName.trim() || undefined,
      sugar: dSugar,
      calories: dCal ? Number(dCal) : null,
      date: drinkDate, // 支持补记到选中的过去日期
    });
    setDBrand("");
    setDName("");
    setDCal("");
    reloadTreats();
  }

  async function addSnack() {
    await logSnack({
      subtype: sSub,
      name: sName.trim() || undefined,
      calories: sCal ? Number(sCal) : null,
      date: drinkDate,
    });
    setSName("");
    setSCal("");
    reloadTreats();
  }

  async function saveMeal(k: MealKey) {
    const m = meals[k];
    await setMeal(today, k, m.content.trim(), m.calories ? Number(m.calories) : null);
  }

  const shownDrinks = drinks.filter((d) => d.date === drinkDate);
  const shownSnacks = snacks.filter((s) => s.date === drinkDate);
  const monthPrefix = today.slice(0, 8);
  const monthCount = drinks.filter((d) => d.date.startsWith(monthPrefix)).length;
  const snackMonthCount = snacks.filter((s) => s.date.startsWith(monthPrefix)).length;

  const todaySupp = SCHEDULE[todayNum];

  function changeTarget(v: string) {
    const n = Math.round(Number(v));
    setCalTargetState(n);
    if (n > 0) setCalTarget(n);
  }

  // 卡路里预算：晚餐可吃 = 目标 − 早 − 午 − 今天的饮品/零食（实时）
  // ⚠️ 饮品和零食**必须**算进来：`dayCalories()`（今日总览、小表格用）一直是按
  // 三餐+treat_log 汇总的，这里以前只加三餐，导致记了奶茶后两处数字对不上（2026-07-28 修）。
  const num = (s: string) => Number(s) || 0;
  const bf = num(meals.早.calories);
  const lu = num(meals.午.calories);
  const dn = num(meals.晚.calories);
  const treatCal =
    drinks.filter((d) => d.date === today).reduce((s, d) => s + (d.calories ?? 0), 0) +
    snacks.filter((s) => s.date === today).reduce((sum, s) => sum + (s.calories ?? 0), 0);
  const eaten = bf + lu + dn + treatCal;
  const dinnerAllow = calTarget - bf - lu - treatCal;
  const scaleMax = Math.max(calTarget, BMR, eaten, 1) * 1.08;
  const pctOf = (v: number) => `${Math.min(100, (v / scaleMax) * 100)}%`;
  const belowBmr = calTarget > 0 && calTarget < BMR;

  const caloriePanel = (
    <section className="shrink-0 rounded-xl border bg-card p-4">
      <div className="mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold">今日卡路里</h2>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          目标
          <input
            type="number"
            value={calTarget || ""}
            onChange={(e) => changeTarget(e.target.value)}
            className="h-8 w-20 rounded-md border bg-transparent px-2 text-sm"
          />
          kcal
        </label>
        <span className="ml-auto text-sm">
          晚餐还能吃{" "}
          <b className={cn("font-medium", dinnerAllow < 0 ? "text-red-600" : "text-emerald-600")}>
            {dinnerAllow < 0 ? `超 ${-dinnerAllow}` : dinnerAllow}
          </b>{" "}
          kcal
        </span>
      </div>
      <div className="relative h-4 overflow-hidden rounded-full bg-muted">
        <div className="absolute inset-y-0 left-0 bg-sky-500" style={{ width: pctOf(bf) }} />
        <div className="absolute inset-y-0 bg-sky-300" style={{ left: pctOf(bf), width: pctOf(lu) }} />
        <div className="absolute inset-y-0 bg-violet-400" style={{ left: pctOf(bf + lu), width: pctOf(dn) }} />
        {/* 饮品+零食单独一段琥珀色，一眼看出「今天超的是不是零食喝的」 */}
        <div className="absolute inset-y-0 bg-amber-400" style={{ left: pctOf(bf + lu + dn), width: pctOf(treatCal) }} title="饮品 + 零食" />
        <div className="absolute inset-y-0 z-10 w-0.5 bg-foreground/70" style={{ left: pctOf(calTarget) }} title="今日目标" />
        <div className="absolute inset-y-0 z-10 w-0.5 bg-red-500" style={{ left: pctOf(BMR) }} title="基础代谢，别低于" />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <span><span className="text-red-500">│</span> 基代 {BMR}（别低于）</span>
        <span>│ 目标 {calTarget}</span>
        <span className="text-emerald-600">减脂安全区 {BMR}–1550</span>
        <span>
          已吃 {eaten}
          {treatCal > 0 && <span className="text-amber-600">（含饮品零食 {treatCal}）</span>}
        </span>
      </div>
      {belowBmr && (
        <p className="mt-1.5 text-xs text-red-600">
          ⚠ 目标低于基础代谢（{BMR}），长期这样当心掉发/停经；想减脂建议压在 {BMR}–1550、配够蛋白。
        </p>
      )}
    </section>
  );

  return (
    // 版式定稿（2026-07-29 方案 1）：统一一套规格——卡片 rounded-xl + p-4 + bg-card + 标题在卡内，
    // 卡内小块 rounded-lg + bg-muted（浅一层，层级一眼读得出）。三餐不再等分撑高（那片空白是撑出来的）。
    // 左栏＝今天吃什么（补剂 → 早 → 午 → 晚）+ 本周复盘；右栏＝体重 / 饮品 / 零食 / 月历。
    // 撑满视口（2026-07-29 Rosie 要求「删完没填满就自动扩充」）：两栏拉伸等高，
    // 各自的**最后一张卡**吸收剩余高度、内容仍顶对齐——卡片边框到底看着是有意的。
    // ⚠️ 不要再像上一版那样把剩余高度平摊给每张餐卡，那会让每张卡中间空一块。
    <div className="flex min-h-full flex-col gap-6 p-6">
      {caloriePanel}

      <div
        className="grid flex-1 items-stretch gap-6"
        style={{ gridTemplateColumns: "minmax(0,1.18fr) minmax(0,1fr)" }}
      >
        {/* ───────── 左栏 ───────── */}
        <div className="flex flex-col gap-6">
          {/* flex-1：这一栏的剩余高度由「今天吃什么」吸收，再往下由三个餐框分掉
              （2026-07-29 Rosie：「白白的放在这里好丑，剩下的分给早午晚餐」）。
              ⚠️ 补剂不参与分——它是只读参考，拉高只会更空。 */}
          <section className="flex flex-1 flex-col rounded-xl border bg-card p-4">
            <h2 className="text-lg font-semibold">今天吃什么</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {today.slice(5).replace("-", "月")}日 {DAY_NAMES[todayNum]} · 补剂按早/午/晚跟着三餐走；
              三餐写下你实际吃了什么，把内容发我、我帮你算热量。
            </p>

            {periodOn && (
              <div className="mt-3 rounded-lg border border-pink-200 bg-pink-50 p-3">
                <p className="mb-1.5 text-sm font-medium text-pink-800">🩸 经期饮食建议</p>
                <ul className="space-y-1 text-sm text-pink-700">
                  {PERIOD_MEAL_TIPS.map((t) => (
                    <li key={t} className="flex gap-1.5">
                      <span className="shrink-0">·</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2.5">
              {/* 补剂：搬到早餐上面（2026-07-29 Rosie 定）。它本来就按早/午/晚排，
                  跟三餐同一个时间轴；而且「随餐吃 / 跟早餐一起」这句提示终于挨着餐了。
                  做成只读浅色小块，跟下面三张能输入的餐卡区分开——它是参考不是录入。
                  shrink-0：不参与分剩余高度（只读的东西拉高只会更空）。 */}
              <div className="shrink-0 rounded-lg bg-muted px-3 py-2.5">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">补剂</span>
                  <span className="text-xs text-muted-foreground">
                    脂溶性的（维D、辅酶Q10）随餐吃吸收好；复合维B 空腹易反胃，跟早餐一起
                  </span>
                </div>
                {periodOn ? (
                  <p className="mt-1.5 text-sm text-pink-700">🩸 经期中：无需进食补剂</p>
                ) : (
                  <div className="mt-1.5 space-y-1">
                    {(
                      [
                        ["早", todaySupp.morning],
                        ["午", todaySupp.noon],
                        ["晚", todaySupp.evening],
                      ] as const
                    ).map(([label, arr]) => (
                      <div key={label} className="flex items-baseline gap-2.5 text-sm">
                        <span className="w-5 shrink-0 text-xs text-muted-foreground">{label}</span>
                        {arr.length ? (
                          <span className="flex flex-wrap gap-1.5">
                            {arr.map((name) => (
                              <span
                                key={name}
                                className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-0.5 text-xs text-violet-700"
                              >
                                <span className="size-1.5 rounded-full bg-violet-500" />
                                {name}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground/60">无</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {MEALS.map((m) => (
                // flex-1：三个餐框平分补剂之外的剩余高度；min-h-28 保底不会被挤扁
                <div key={m.key} className="flex min-h-28 flex-1 flex-col rounded-lg bg-muted px-3 py-2.5">
                  <p className="font-medium">{m.label}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    <span className="mr-1">🍳 自己做</span>
                    {m.cook}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <span className="mr-1">🥡 外卖</span>
                    {m.takeout}
                  </p>
                  {/* mt-auto：框被拉高后输入行沉到底，上面推荐、下面填写，中间不留空洞 */}
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                    <Input
                      value={meals[m.key].content}
                      onChange={(e) =>
                        setMeals((s) => ({ ...s, [m.key]: { ...s[m.key], content: e.target.value } }))
                      }
                      onBlur={() => saveMeal(m.key)}
                      placeholder="我今天这一餐吃了……"
                      className="min-w-48 flex-1 bg-card"
                    />
                    <Input
                      type="number"
                      value={meals[m.key].calories}
                      onChange={(e) =>
                        setMeals((s) => ({ ...s, [m.key]: { ...s[m.key], calories: e.target.value } }))
                      }
                      onBlur={() => saveMeal(m.key)}
                      placeholder="大约 kcal"
                      className="w-24 bg-card"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 本周复盘：挪到左栏最下（看完今天，顺着往下就是这周）。走 hash，Tauri 桌面端也通用。
              2026-07-29 加大一倍——它是这页唯一的出口，原来那条太细、像个脚注。 */}
          <button
            onClick={() => {
              window.location.hash = "/mini-table/tbl-meals-week";
            }}
            className="w-full shrink-0 rounded-xl border bg-card px-5 py-6 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
          >
            <span className="flex items-center gap-2 text-lg font-semibold text-primary">
              本周复盘 <span aria-hidden="true">→</span>
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              三餐周表：空腹/睡前体重 · 早午晚吃了什么 · 零食饮品 · 总摄入卡路里
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground/70">
              全部自动填好，直接看这一周的走势
            </span>
          </button>
        </div>

        {/* ───────── 右栏 ───────── */}
        <div className="flex flex-col gap-6">
          <WeightPair lastNight={wLastPm} thisMorning={wTodayAm} onSave={saveWeight} />

          {/* 饮品打卡 */}
          <section className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h2 className="text-lg font-semibold">饮品打卡 🧋</h2>
              <span className="text-sm text-muted-foreground">本月 {monthCount} 杯</span>
            </div>
            <div className="mt-3 space-y-2 rounded-lg bg-muted px-3 py-2.5">
              <DateLine date={drinkDate} today={today} onBackToToday={() => setDrinkDate(today)} />
              <div className="flex flex-wrap gap-2">
                {SUBTYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setDSub(t)}
                    className={cn(
                      "rounded-full px-3 py-1 text-sm transition-colors",
                      dSub === t
                        ? DRINK_COLOR[t].chip + " font-medium"
                        : "border bg-card text-muted-foreground",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Input value={dBrand} onChange={(e) => setDBrand(e.target.value)} placeholder="品牌（喜茶…）" className="w-28 bg-card" />
                <Input value={dName} onChange={(e) => setDName(e.target.value)} placeholder="名字（芝芝莓莓…）" className="min-w-28 flex-1 bg-card" />
                <select
                  value={dSugar}
                  onChange={(e) => setDSugar(e.target.value)}
                  className="h-9 rounded-md border bg-card px-2 text-sm"
                >
                  {SUGARS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <Input type="number" value={dCal} onChange={(e) => setDCal(e.target.value)} placeholder="kcal" className="w-20 bg-card" />
                <Button onClick={addDrink}>记一杯</Button>
              </div>
              {/* 「今天还没记」收进卡内，不再是裸文本贴在卡外飘着 */}
              {/* 空态不再显示「今天还没记…」（Rosie 2026-07-29 要求删）——
                  表单就在上面，没记这件事本身不需要一句话来说 */}
              {shownDrinks.length > 0 && (
                <div className="space-y-1.5">
                  {shownDrinks.map((d) => (
                    <TreatRow
                      key={d.id}
                      dot={DRINK_COLOR[d.subtype].dot}
                      text={[d.brand, d.name].filter(Boolean).join(" ") + (d.sugar ? ` · ${d.sugar}` : "")}
                      calories={d.calories}
                      onDelete={async () => {
                        await deleteTreat(d.id);
                        reloadTreats();
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* 零食打卡 */}
          <section className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h2 className="text-lg font-semibold">零食打卡 🥜</h2>
              <span className="text-sm text-muted-foreground">
                本月 {snackMonthCount} 次
                {shownSnacks.length > 0 &&
                  ` · ${drinkDate === today ? "今天" : drinkDate.slice(5)} ${shownSnacks.length} 次`}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              顶饿又不炸：一小把坚果 / 无糖酸奶 / 黑巧 2 块 / 一个水果。热量算进上面的「已吃」。
            </p>
            <div className="mt-3 space-y-2 rounded-lg bg-muted px-3 py-2.5">
              <DateLine date={drinkDate} today={today} onBackToToday={() => setDrinkDate(today)} />
              <div className="flex flex-wrap gap-2">
                {SNACK_SUBTYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setSSub(t)}
                    className={cn(
                      "rounded-full px-3 py-1 text-sm transition-colors",
                      sSub === t
                        ? "bg-amber-100 font-medium text-amber-700"
                        : "border bg-card text-muted-foreground",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Input
                  value={sName}
                  onChange={(e) => setSName(e.target.value)}
                  placeholder="吃了什么（一小把巴旦木…）"
                  className="min-w-32 flex-1 bg-card"
                />
                <Input type="number" value={sCal} onChange={(e) => setSCal(e.target.value)} placeholder="kcal" className="w-20 bg-card" />
                <Button onClick={addSnack}>记一笔</Button>
              </div>
              {shownSnacks.length > 0 && (
                <div className="space-y-1.5">
                  {shownSnacks.map((s) => (
                    <TreatRow
                      key={s.id}
                      dot="bg-amber-500"
                      text={[s.subtype, s.name].filter(Boolean).join(" · ")}
                      calories={s.calories}
                      onDelete={async () => {
                        await deleteTreat(s.id);
                        reloadTreats();
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* 月历：饮品零食共用（点某天两边都补记到那天）。
              flex-1＝这一栏的剩余高度归它，日历本身照旧顶对齐 */}
          <DrinkCalendar
            drinks={drinks}
            snacks={snacks}
            selected={drinkDate}
            onSelect={setDrinkDate}
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
}

const supplementModule: AppModule = {
  manifest: {
    id: "supplement",
    name: "饮食",
    icon: Utensils,
    description: "补剂 + 三餐记录 + 饮品日历打卡",
    defaultSize: { w: 1, h: 1 },
  },
  Card,
  Page,
};

export default supplementModule;
