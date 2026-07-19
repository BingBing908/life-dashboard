import { useEffect, useState } from "react";
import { Pill } from "lucide-react";
import type { AppModule } from "../types";
import { getPeriodOn } from "../study-plan/data";

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

  if (periodOn) {
    return (
      <p className="text-sm text-pink-700">🩸 经期停用补剂，这几天先歇着</p>
    );
  }

  const s = SCHEDULE[dayNum()];
  return (
    <div className="space-y-1.5">
      <Slot label="早" items={s.morning} />
      <Slot label="午" items={s.noon} />
      <Slot label="晚" items={s.evening} />
    </div>
  );
}

function Page() {
  const todayNum = dayNum();
  const [periodOn, setPeriodOn] = useState(false);
  useEffect(() => {
    getPeriodOn().then(setPeriodOn).catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-2xl font-semibold">补剂</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        脂溶性的（维D、辅酶Q10）随餐吃吸收好；复合维B 空腹易反胃，跟早餐一起。
      </p>
      {periodOn && (
        <div className="mb-4 rounded-lg border border-pink-200 bg-pink-50 px-4 py-2.5 text-sm text-pink-700">
          🩸 经期停用中——下表仅供参考，经期结束关掉「经期模式」即恢复
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
              const fmt = (a: string[]) => (a.length ? a.join(" · ") : "—");
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
    </div>
  );
}

const supplementModule: AppModule = {
  manifest: {
    id: "supplement",
    name: "补剂",
    icon: Pill,
    description: "今日早中晚该吃的补剂",
    defaultSize: { w: 1, h: 1 },
  },
  Card,
  Page,
};

export default supplementModule;
