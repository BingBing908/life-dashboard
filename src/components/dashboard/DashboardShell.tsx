import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { modules } from "@/modules/registry";

interface Props {
  onOpenModule: (id: string) => void;
}

/** 仪表盘首页：以网格卡片形式展示每个模块的摘要视图 */
export function DashboardShell({ onOpenModule }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4 p-6 lg:grid-cols-4">
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
  );
}
