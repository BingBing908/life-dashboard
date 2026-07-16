import { useState } from "react";
import { LayoutDashboard } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { modules, getModule } from "@/modules/registry";
import { cn } from "@/lib/utils";

export default function App() {
  const [view, setView] = useState("dashboard");
  const active = view === "dashboard" ? null : getModule(view);

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* 侧边栏 */}
      <aside className="flex w-52 shrink-0 flex-col border-r bg-sidebar">
        <div className="px-4 py-4 text-lg font-semibold">个人工具</div>
        <nav className="flex flex-col gap-1 px-2">
          <SidebarItem
            icon={LayoutDashboard}
            label="仪表盘"
            active={view === "dashboard"}
            onClick={() => setView("dashboard")}
          />
          {modules.map(({ manifest }) => (
            <SidebarItem
              key={manifest.id}
              icon={manifest.icon}
              label={manifest.name}
              active={view === manifest.id}
              onClick={() => setView(manifest.id)}
            />
          ))}
        </nav>
      </aside>

      {/* 主区域 */}
      <main className="flex-1 overflow-y-auto">
        {active ? <active.Page /> : <DashboardShell onOpenModule={setView} />}
      </main>
    </div>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50",
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}
