import { useEffect, useState } from "react";
import { LayoutDashboard } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { modules, getModule } from "@/modules/registry";
import { cn } from "@/lib/utils";
import { runSync } from "@/lib/sync";

/** 从 URL hash 解析当前页（#/todo → "todo"），非法/空则回仪表盘。
 *  用 hash 路由：GitHub Pages 无需服务端配置，Tauri 单页也通用，刷新停在原页。 */
function parseHash(): string {
  const h = window.location.hash.replace(/^#\/?/, "");
  if (!h || h === "dashboard") return "dashboard";
  return getModule(h) ? h : "dashboard";
}

export default function App() {
  const [view, setViewState] = useState(parseHash);
  const [booting, setBooting] = useState(true); // 首次同步完成前不渲染模块，避免空库重复播种
  const [syncTick, setSyncTick] = useState(0); // 拉到新数据后 +1，用作 key 强制刷新视图

  // 监听前进/后退与手动改 hash
  useEffect(() => {
    const onHash = () => setViewState(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // 云端同步：首次进入先同步再渲染（带 4s 超时，离线也能进）；之后聚焦/定时增量同步
  useEffect(() => {
    let alive = true;
    const bump = (changed: boolean) => {
      if (alive && changed) setSyncTick((t) => t + 1);
    };
    const initial = runSync().then(bump);
    const timeout = new Promise((r) => setTimeout(r, 4000));
    Promise.race([initial, timeout]).then(() => {
      if (alive) setBooting(false);
    });

    // 后台同步只推/拉数据，不 bump（不重挂载）——否则会打断正在进行的操作（如默写）、
    // 把用户从当前板块弹回首页。拉到的新数据在下次进入页面时自然显示。
    const onFocus = () => runSync();
    window.addEventListener("focus", onFocus);
    const iv = setInterval(onFocus, 30_000);
    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
      clearInterval(iv);
    };
  }, []);

  function setView(id: string) {
    window.location.hash = id === "dashboard" ? "/" : `/${id}`;
    setViewState(id);
  }

  const active = view === "dashboard" ? null : getModule(view);

  if (booting) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        <p className="animate-pulse text-sm">正在同步云端数据…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* 侧边栏 */}
      <aside className="flex w-52 shrink-0 flex-col border-r bg-sidebar">
        <div className="px-4 py-4 text-lg font-semibold">个人工具</div>
        <nav className="flex flex-col gap-1 px-2">
          <SidebarItem
            icon={LayoutDashboard}
            label="今日总览"
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

      {/* 主区域（syncTick 变化＝拉到云端新数据，用 key 强制重新加载视图） */}
      <main key={syncTick} className="flex-1 overflow-y-auto">
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
