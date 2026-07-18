import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Solar } from "lunar-javascript";
import { cn } from "@/lib/utils";
import { toDateStr, todayStr } from "@/lib/dates";

interface Props {
  selected: string;
  onSelect: (date: string) => void;
}

interface Cell {
  date: string;
  day: number;
  inMonth: boolean;
  lunar: string;
  isFestival: boolean;
}

/** 农历/节气文字：节气 > 农历初一显示月名 > 日名 */
function lunarText(y: number, m: number, d: number): { text: string; festival: boolean } {
  const lunar = Solar.fromYmd(y, m, d).getLunar();
  const jieQi: string = lunar.getJieQi();
  if (jieQi) return { text: jieQi, festival: true };
  if (lunar.getDay() === 1) return { text: lunar.getMonthInChinese() + "月", festival: true };
  return { text: lunar.getDayInChinese(), festival: false };
}

function buildMonth(year: number, month: number): Cell[] {
  const first = new Date(year, month - 1, 1);
  const lead = (first.getDay() + 6) % 7; // 周一开头
  const cells: Cell[] = [];
  const start = new Date(year, month - 1, 1 - lead);
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const { text, festival } = lunarText(d.getFullYear(), d.getMonth() + 1, d.getDate());
    cells.push({
      date: toDateStr(d),
      day: d.getDate(),
      inMonth: d.getMonth() === month - 1,
      lunar: text,
      isFestival: festival,
    });
  }
  // 去掉整行都不属于本月的末尾行
  while (cells.length > 35 && cells.slice(35).every((c) => !c.inMonth)) cells.splice(35);
  return cells;
}

export function MiniCalendar({ selected, onSelect }: Props) {
  const today = todayStr();
  const sel = new Date(selected + "T00:00:00");
  const [year, setYear] = useState(sel.getFullYear());
  const [month, setMonth] = useState(sel.getMonth() + 1);

  function shift(n: number) {
    const d = new Date(year, month - 1 + n, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  }

  const cells = buildMonth(year, month);

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-2 flex items-center">
        <span className="text-sm font-semibold">
          {year}年{month}月
        </span>
        <span className="ml-auto flex">
          <button
            className="rounded p-1 text-muted-foreground hover:bg-accent"
            title="上个月"
            onClick={() => shift(-1)}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            className="rounded p-1 text-muted-foreground hover:bg-accent"
            title="下个月"
            onClick={() => shift(1)}
          >
            <ChevronRight className="size-4" />
          </button>
        </span>
      </div>

      <div className="grid grid-cols-7 text-center">
        {["一", "二", "三", "四", "五", "六", "日"].map((w) => (
          <span key={w} className="py-1 text-xs text-muted-foreground">
            {w}
          </span>
        ))}
        {cells.map((c) => {
          const isSel = c.date === selected;
          const isToday = c.date === today;
          return (
            <button
              key={c.date}
              onClick={() => onSelect(c.date)}
              className={cn(
                "rounded-lg py-1 leading-tight transition-colors",
                isSel ? "bg-primary" : "hover:bg-accent",
              )}
            >
              <span
                className={cn(
                  "block text-[13px] font-medium",
                  isSel
                    ? "text-primary-foreground"
                    : !c.inMonth
                      ? "text-muted-foreground/40"
                      : isToday
                        ? "text-primary"
                        : "text-foreground",
                )}
              >
                {c.day}
              </span>
              <span
                className={cn(
                  "block text-[10px]",
                  isSel
                    ? "text-primary-foreground/80"
                    : !c.inMonth
                      ? "text-muted-foreground/30"
                      : c.isFestival
                        ? "text-primary/80"
                        : "text-muted-foreground",
                )}
              >
                {c.lunar}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
