import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pill, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toDateStr, todayStr } from "@/lib/dates";
import type { AppModule } from "../types";
import { dayNumOf, getPeriodOn } from "../study-plan/data";
import {
  deleteDrink,
  getMeals,
  listDrinks,
  logDrink,
  setMeal,
  type Drink,
  type DrinkSubtype,
  type MealKey,
} from "./data";

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

const SUBTYPES: DrinkSubtype[] = ["奶茶", "果茶", "酸奶"];
const SUGARS = ["无糖", "三分糖", "五分糖", "七分糖", "全糖"];
const DRINK_COLOR: Record<DrinkSubtype, { dot: string; chip: string }> = {
  奶茶: { dot: "bg-red-500", chip: "bg-red-50 text-red-700" },
  果茶: { dot: "bg-green-500", chip: "bg-green-50 text-green-700" },
  酸奶: { dot: "bg-violet-500", chip: "bg-violet-50 text-violet-700" },
};

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

/** 饮品月历：有饮品的日子按品类上色（奶茶红/果茶绿/酸奶紫），今天描环 */
function DrinkCalendar({ drinks }: { drinks: Drink[] }) {
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
    <div className="w-56 shrink-0 rounded-xl border bg-card p-2.5">
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
          return (
            <div key={date} className="flex justify-center">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[11px]",
                  color ? color + " text-white" : "text-foreground",
                  date === today && !color && "ring-1 ring-primary",
                )}
                title={date}
              >
                {day}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-center gap-2 text-[10px] text-muted-foreground">
        <span><span className="mr-0.5 inline-block size-2 rounded-full bg-red-500 align-middle" />奶茶</span>
        <span><span className="mr-0.5 inline-block size-2 rounded-full bg-green-500 align-middle" />果茶</span>
        <span><span className="mr-0.5 inline-block size-2 rounded-full bg-violet-500 align-middle" />酸奶</span>
      </div>
    </div>
  );
}

function Page() {
  const today = todayStr();
  const todayNum = dayNumOf(todayStr());
  const [periodOn, setPeriodOn] = useState(false);
  const [drinks, setDrinks] = useState<Drink[]>([]);
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

  const reloadDrinks = useCallback(() => {
    const since = toDateStr(new Date(Date.now() - 100 * 864e5));
    listDrinks(since).then(setDrinks).catch(() => {});
  }, []);

  useEffect(() => {
    getPeriodOn().then(setPeriodOn).catch(() => {});
    reloadDrinks();
    getMeals(today).then((m) => {
      setMeals({
        早: { content: m.早.content ?? "", calories: m.早.calories?.toString() ?? "" },
        午: { content: m.午.content ?? "", calories: m.午.calories?.toString() ?? "" },
        晚: { content: m.晚.content ?? "", calories: m.晚.calories?.toString() ?? "" },
      });
    });
  }, [today, reloadDrinks]);

  async function addDrink() {
    await logDrink({
      subtype: dSub,
      brand: dBrand.trim() || undefined,
      name: dName.trim() || undefined,
      sugar: dSugar,
      calories: dCal ? Number(dCal) : null,
    });
    setDBrand("");
    setDName("");
    setDCal("");
    reloadDrinks();
  }

  async function saveMeal(k: MealKey) {
    const m = meals[k];
    await setMeal(today, k, m.content.trim(), m.calories ? Number(m.calories) : null);
  }

  const todayDrinks = drinks.filter((d) => d.date === today);
  const monthPrefix = today.slice(0, 8);
  const monthCount = drinks.filter((d) => d.date.startsWith(monthPrefix)).length;

  const fmt = (a: string[]) => (a.length ? a.join(" · ") : "—");
  const todaySupp = SCHEDULE[todayNum];

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      {/* 补剂 */}
      <section>
        <h2 className="mb-1 text-lg font-semibold">补剂（今天 · {DAY_NAMES[todayNum]}）</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          脂溶性的（维D、辅酶Q10）随餐吃吸收好；复合维B 空腹易反胃，跟早餐一起。
        </p>
        {periodOn ? (
          <div className="rounded-xl border border-pink-200 bg-pink-50 px-4 py-3 text-sm text-pink-700">
            🩸 经期中：无需进食补剂
          </div>
        ) : (
          <div className="divide-y overflow-hidden rounded-xl border">
            {([["早", todaySupp.morning], ["午", todaySupp.noon], ["晚", todaySupp.evening]] as const).map(
              ([label, arr]) => (
                <div key={label} className="flex items-center gap-4 px-4 py-2.5 text-sm">
                  <span className="w-8 shrink-0 text-muted-foreground">{label}</span>
                  <span className={arr.length ? "" : "text-muted-foreground"}>{fmt(arr)}</span>
                </div>
              ),
            )}
          </div>
        )}
      </section>

      {/* 三餐：推荐 + 记录 */}
      <section>
        <h2 className="mb-1 text-lg font-semibold">三餐（今天）</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          写下你实际吃了什么，把内容发我、我帮你算热量，再把数字填进「大约 kcal」。
        </p>
        <div className="space-y-3">
          {MEALS.map((m) => (
            <div key={m.key} className="rounded-lg border p-4">
              <p className="mb-1.5 font-medium">{m.label}</p>
              <p className="text-sm">
                <span className="mr-1 text-muted-foreground">🍳 自己做</span>
                {m.cook}
              </p>
              <p className="mb-2 mt-1 text-sm">
                <span className="mr-1 text-muted-foreground">🥡 外卖</span>
                {m.takeout}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={meals[m.key].content}
                  onChange={(e) =>
                    setMeals((s) => ({ ...s, [m.key]: { ...s[m.key], content: e.target.value } }))
                  }
                  onBlur={() => saveMeal(m.key)}
                  placeholder="我今天这一餐吃了……"
                  className="min-w-48 flex-1"
                />
                <Input
                  type="number"
                  value={meals[m.key].calories}
                  onChange={(e) =>
                    setMeals((s) => ({ ...s, [m.key]: { ...s[m.key], calories: e.target.value } }))
                  }
                  onBlur={() => saveMeal(m.key)}
                  placeholder="大约 kcal"
                  className="w-24"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 饮品打卡 */}
      <section>
        <div className="mb-1 flex items-baseline gap-2">
          <h2 className="text-lg font-semibold">饮品打卡 🧋</h2>
          <span className="text-sm text-muted-foreground">本月 {monthCount} 杯</span>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="min-w-0 flex-1 space-y-3">
            {/* 记一杯表单 */}
            <div className="space-y-2 rounded-xl border p-3">
              <div className="flex flex-wrap gap-2">
                {SUBTYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setDSub(t)}
                    className={cn(
                      "rounded-full px-3 py-1 text-sm transition-colors",
                      dSub === t ? DRINK_COLOR[t].chip + " font-medium" : "border text-muted-foreground",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Input value={dBrand} onChange={(e) => setDBrand(e.target.value)} placeholder="品牌（喜茶…）" className="w-32" />
                <Input value={dName} onChange={(e) => setDName(e.target.value)} placeholder="名字（芝芝莓莓…）" className="min-w-36 flex-1" />
                <select
                  value={dSugar}
                  onChange={(e) => setDSugar(e.target.value)}
                  className="h-9 rounded-md border bg-transparent px-2 text-sm"
                >
                  {SUGARS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <Input type="number" value={dCal} onChange={(e) => setDCal(e.target.value)} placeholder="kcal(可空)" className="w-24" />
                <Button onClick={addDrink}>记一杯</Button>
              </div>
            </div>

            {/* 今日已记 */}
            <div className="space-y-1.5">
              {todayDrinks.length === 0 && (
                <p className="text-sm text-muted-foreground">今天还没记饮品。</p>
              )}
              {todayDrinks.map((d) => (
                <div key={d.id} className="group flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <span className={cn("size-2 shrink-0 rounded-full", DRINK_COLOR[d.subtype].dot)} />
                  <span className="min-w-0 flex-1 truncate">
                    {[d.brand, d.name].filter(Boolean).join(" ")}
                    {d.sugar ? ` · ${d.sugar}` : ""}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {d.calories != null ? `${d.calories} kcal` : "热量待算"}
                  </span>
                  <button
                    className="invisible shrink-0 text-muted-foreground hover:text-destructive group-hover:visible"
                    onClick={async () => {
                      await deleteDrink(d.id);
                      reloadDrinks();
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 右上角日历 */}
          <DrinkCalendar drinks={drinks} />
        </div>
      </section>
    </div>
  );
}

const supplementModule: AppModule = {
  manifest: {
    id: "supplement",
    name: "饮食",
    icon: Pill,
    description: "补剂 + 三餐记录 + 饮品日历打卡",
    defaultSize: { w: 1, h: 1 },
  },
  Card,
  Page,
};

export default supplementModule;
