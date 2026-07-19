import { useEffect, useState } from "react";
import { Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { todayStr } from "@/lib/dates";
import type { AppModule } from "../types";
import { getPeriodOn } from "../study-plan/data";
import { logTreat, treatStats, undoTreatToday, type TreatStats } from "./data";

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

/** 经期版：停鱼油等，只保留小红镁 */
const PERIOD_SCHEDULE = { morning: [] as string[], noon: [] as string[], evening: ["小红镁"] };

const DAY_NAMES = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"];

const MEALS: { meal: string; cook: string; takeout: string }[] = [
  {
    meal: "早餐",
    cook: "水煮蛋 2 个 + 无糖燕麦牛奶 + 一小把莓果 / 一个苹果",
    takeout: "便利店：茶叶蛋 + 无糖豆浆 + 水煮玉米",
  },
  {
    meal: "午餐",
    cook: "鸡胸 / 虾 + 糙米饭一拳 + 清炒时蔬两拳",
    takeout: "轻食沙拉（鸡胸 + 杂蔬，油醋汁减半）/ 清汤麻辣烫（多菜 + 鸡胸豆腐，免麻酱油碟）",
  },
  {
    meal: "晚餐",
    cook: "清蒸鱼 / 豆腐 + 大量绿叶菜，主食减半或不吃",
    takeout: "关东煮（萝卜 / 海带 / 豆腐 / 蛋，少丸子）/ 白灼虾鸡 + 焯青菜",
  },
];

function dayNum(d = new Date()): number {
  return ((d.getDay() + 6) % 7) + 1;
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

  const s = periodOn ? PERIOD_SCHEDULE : SCHEDULE[dayNum()];
  return (
    <div className="space-y-1.5">
      <Slot label="早" items={s.morning} />
      <Slot label="午" items={s.noon} />
      <Slot label="晚" items={s.evening} />
      {periodOn && (
        <p className="text-xs text-pink-700">🩸 经期：停鱼油等，仅保留小红镁</p>
      )}
    </div>
  );
}

function Page() {
  const todayNum = dayNum();
  const [periodOn, setPeriodOn] = useState(false);
  const [stats, setStats] = useState<TreatStats | null>(null);

  useEffect(() => {
    getPeriodOn().then(setPeriodOn).catch(() => {});
    treatStats().then(setStats).catch(() => {});
  }, []);

  async function addTea() {
    await logTreat();
    setStats(await treatStats());
  }
  async function undoTea() {
    await undoTreatToday();
    setStats(await treatStats());
  }

  const fmt = (a: string[]) => (a.length ? a.join(" · ") : "—");

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      {/* 补剂 */}
      <section>
        <h2 className="mb-1 text-lg font-semibold">补剂</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          脂溶性的（维D、辅酶Q10）随餐吃吸收好；复合维B 空腹易反胃，跟早餐一起。
        </p>
        {periodOn && (
          <div className="mb-3 rounded-lg border border-pink-200 bg-pink-50 px-4 py-2.5 text-sm text-pink-700">
            🩸 经期中：停鱼油等，仅保留晚间小红镁（下表为平时安排，供参考）
          </div>
        )}
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-4 py-2 font-medium"> </th>
                <th className="px-4 py-2 font-medium">早</th>
                <th className="px-4 py-2 font-medium">午</th>
                <th className="px-4 py-2 font-medium">晚</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                const s = SCHEDULE[d];
                return (
                  <tr
                    key={d}
                    className={
                      "border-b last:border-0 " +
                      (d === todayNum ? "bg-accent/60 font-medium" : "")
                    }
                  >
                    <td className="px-4 py-2 text-muted-foreground">
                      {DAY_NAMES[d]}
                      {d === todayNum && " ·今天"}
                    </td>
                    <td className="px-4 py-2">{fmt(s.morning)}</td>
                    <td className="px-4 py-2">{fmt(s.noon)}</td>
                    <td className="px-4 py-2">{fmt(s.evening)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 三餐推荐 */}
      <section>
        <h2 className="mb-1 text-lg font-semibold">三餐推荐</h2>
        <p className="mb-3 text-sm text-muted-foreground">减脂期原则：蛋白吃够、糖油少、晚餐轻、喝够水。</p>
        <div className="space-y-2">
          {MEALS.map((m) => (
            <div key={m.meal} className="rounded-lg border px-4 py-3">
              <p className="mb-1.5 font-medium">{m.meal}</p>
              <p className="text-sm">
                <span className="mr-1 text-muted-foreground">🍳 自己做</span>
                {m.cook}
              </p>
              <p className="mt-1 text-sm">
                <span className="mr-1 text-muted-foreground">🥡 外卖</span>
                {m.takeout}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 奶茶打卡 */}
      <section>
        <h2 className="mb-1 text-lg font-semibold">奶茶打卡 🧋</h2>
        <p className="mb-3 text-sm text-muted-foreground">喝了就记一杯——不评判，只是让你看得见。</p>
        <div className="flex flex-wrap items-center gap-3 rounded-xl border p-4">
          <Button onClick={addTea}>记一杯 🧋</Button>
          {stats && stats.todayCount > 0 && (
            <Button variant="ghost" size="sm" onClick={undoTea}>
              撤销一杯
            </Button>
          )}
          <div className="ml-auto flex gap-5 text-sm">
            <span>
              今天{" "}
              <span className="font-semibold">{stats?.todayCount ?? 0}</span> 杯
            </span>
            <span>
              本月{" "}
              <span className="font-semibold">{stats?.monthCount ?? 0}</span> 杯
            </span>
            <span className="text-muted-foreground">
              最近：{stats?.lastDate ? (stats.lastDate === todayStr() ? "今天" : stats.lastDate.slice(5)) : "—"}
            </span>
          </div>
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
    description: "补剂 + 三餐推荐 + 奶茶打卡",
    defaultSize: { w: 1, h: 1 },
  },
  Card,
  Page,
};

export default supplementModule;
