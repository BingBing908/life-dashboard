import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { modules } from "@/modules/registry";
import { getPeriodOn, setPeriodOn } from "@/modules/study-plan/data";

interface Props {
  onOpenModule: (id: string) => void;
}

/** 仪表盘首页：全局经期开关 + 各模块摘要卡片网格 */
export function DashboardShell({ onOpenModule }: Props) {
  // 经期模式是全局设置（app_settings.plan_period_on），开关只放这里；
  // 打开后学练计划自动隐藏/替换腹部相关、饮食暂停所有保健品——其它页面不再单独放按钮。
  const [periodOn, setPeriodState] = useState(false);
  useEffect(() => {
    getPeriodOn().then(setPeriodState).catch(() => {});
  }, []);
  async function togglePeriod() {
    const next = !periodOn;
    setPeriodState(next);
    await setPeriodOn(next);
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-end">
        <button
          onClick={togglePeriod}
          title="经期模式：自动隐藏腹部相关训练、暂停所有保健品（全应用生效）"
          className={cn(
            "rounded-full border px-3 py-1 text-sm transition-colors",
            periodOn
              ? "border-pink-300 bg-pink-50 text-pink-700"
              : "text-muted-foreground hover:bg-accent",
          )}
        >
          🩸 经期{periodOn ? "中 · 已避开腹部 + 停保健品" : "模式"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {modules.map(({ manifest, Card: ModuleCard }) => {
          const Icon = manifest.icon;
          const size = manifest.defaultSize ?? { w: 1, h: 1 };
          return (
            <Card
              key={manifest.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpenModule(manifest.id)}
              onKeyDown={(e) => e.key === "Enter" && onOpenModule(manifest.id)}
              className="cursor-pointer transition-colors hover:bg-accent/50"
              style={{
                gridColumn: `span ${size.w}`,
                gridRow: `span ${size.h}`,
              }}
            >
              <CardHeader className="flex flex-row items-center gap-2">
                <Icon className="size-5 text-muted-foreground" />
                <CardTitle className="text-base">{manifest.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <ModuleCard />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
