import { useEffect, useState } from "react";
import { LayoutDashboard, Menu, X } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { modules, getModule } from "@/modules/registry";
import { cn } from "@/lib/utils";
import { getSyncFailures, hasSyncedTable, runSync, syncEnabled } from "@/lib/sync";

/** 从 URL hash 解析当前页（#/todo → "todo"），非法/空则回仪表盘。
 *  用 hash 路由：GitHub Pages 无需服务端配置，Tauri 单页也通用，刷新停在原页。
 *  只取第一段做模块 id，后面的子路径归模块自己解析（如 #/study-log/english 的 english 归日日学）。 */
function parseHash(): string {
  const id = window.location.hash.replace(/^#\/?/, "").split("/")[0];
  if (!id || id === "dashboard") return "dashboard";
  return getModule(id) ? id : "dashboard";
}

/**
 * 首次同步要等多久才放行渲染。
 *
 * ⚠️⚠️ **这台设备一次都没同步成功过时必须等足**（2026-10-27 加，为手机/iPad 上线堵的坑）：
 * 手机 4G 首开要下 sql.js 的 WASM ＋ 全量云数据，4 秒远远不够。超时提前渲染 ⇒ 本地库空着
 * ⇒ 各模块 seedIfEmpty 播种 ⇒ 推上云按「最后写入胜出」**复活她删掉的旧模板**。
 * 播种那侧已经加了守卫（见 sync.ts 末尾「首次同步守卫」），这里多等是为了**别让她看见空页**——
 * 两道一起才既不脏数据、也不难看。
 * 同步过之后恢复 4 秒兜底：离线/弱网照常能进，先拿本地数据用。
 */
function bootTimeoutMs(): number {
  const firstEver = syncEnabled() && !hasSyncedTable("plan_items");
  // ⚠️ 离线时等再久也拉不到东西，照旧 4 秒放行、先用本地数据。
  //    不加这一条的话，她电脑断网时首次打开要白等 20 秒。
  const online = typeof navigator === "undefined" || navigator.onLine !== false;
  return firstEver && online ? 20_000 : 4_000;
}

export default function App() {
  const [view, setViewState] = useState(parseHash);
  const [booting, setBooting] = useState(true); // 首次同步完成前不渲染模块，避免空库重复播种
  const [firstRun] = useState(() => syncEnabled() && !hasSyncedTable("plan_items"));
  const [syncTick, setSyncTick] = useState(0); // 拉到新数据后 +1，用作 key 强制刷新视图
  // 同步失败的表（云端缺列/表没建时必须看得见，见 sync.ts syncFailures 注释）
  const [syncFails, setSyncFails] = useState<{ table: string; message: string }[]>([]);
  // 窄屏（手机 / iPad 竖屏）的抽屉导航开关；≥lg 用常驻侧栏，这个 state 不起作用
  const [navOpen, setNavOpen] = useState(false);

  // 监听前进/后退与手动改 hash
  useEffect(() => {
    const onHash = () => setViewState(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // 云端同步：首次进入先同步再渲染（带超时兜底，离线也能进）；之后聚焦/定时增量同步
  useEffect(() => {
    let alive = true;
    const bump = (changed: boolean) => {
      if (alive && changed) setSyncTick((t) => t + 1);
    };
    const initial = runSync().then((c) => {
      bump(c);
      if (alive) setSyncFails(getSyncFailures());
    });
    const timeout = new Promise((r) => setTimeout(r, bootTimeoutMs()));
    Promise.race([initial, timeout]).then(() => {
      if (alive) setBooting(false);
    });

    // 后台同步只推/拉数据，不 bump（不重挂载）——否则会打断正在进行的操作（如默写）、
    // 把用户从当前板块弹回首页。拉到的新数据在下次进入页面时自然显示。
    const readFails = () => setSyncFails(getSyncFailures());
    const onFocus = () => runSync().then(readFails);
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
    setNavOpen(false); // 抽屉里点一下就走，不用再手动关
  }

  const active = view === "dashboard" ? null : getModule(view);
  const title = active?.manifest.name ?? "总览";

  if (booting) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-2 bg-background px-6 text-center text-muted-foreground">
        <p className="animate-pulse text-sm">正在同步云端数据…</p>
        {firstRun && (
          <p className="text-xs">这台设备第一次打开，要把全部数据拉下来，可能要十几秒</p>
        )}
      </div>
    );
  }

  return (
    // ⚠️ h-dvh 不是 h-screen：iOS Safari 的 100vh 把地址栏也算进去，底部会被裁掉一截
    <div className="flex h-dvh bg-background text-foreground">
      {/* 侧边栏：≥lg（1024px，iPad 横屏及以上）常驻。
          ⚠️ 窄屏刻意不显示——它固定 208px，iPhone 竖屏 375px 会被它吃掉一半以上宽度，
          日程周历那种七列布局直接没法看。窄屏走下面的抽屉。 */}
      <aside className="hidden w-52 shrink-0 flex-col border-r bg-sidebar lg:flex">
        <div className="px-4 py-4 text-lg font-semibold">个人工具</div>
        <NavList view={view} onPick={setView} />
      </aside>

      {/* 窄屏抽屉：点 ☰ 打开，点遮罩或任一项关闭 */}
      {navOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/30"
            onClick={() => setNavOpen(false)}
            aria-hidden
          />
          <nav className="relative flex w-64 flex-col border-r bg-sidebar pt-[env(safe-area-inset-top)] shadow-xl">
            <div className="flex items-center justify-between px-4 py-4">
              <span className="text-lg font-semibold">个人工具</span>
              <button
                onClick={() => setNavOpen(false)}
                aria-label="关闭菜单"
                className="rounded-md p-2 text-muted-foreground hover:bg-sidebar-accent/50"
              >
                <X className="size-5" />
              </button>
            </div>
            <NavList view={view} onPick={setView} big />
          </nav>
        </div>
      )}

      {/* 主区域（syncTick 变化＝拉到云端新数据，用 key 强制重新加载视图） */}
      <main key={syncTick} className="min-w-0 flex-1 overflow-y-auto">
        {/* 窄屏顶栏：汉堡 ＋ 当前页名。
            ⚠️ 刻意放在 main **里面**做吸顶条，而不是在外面再包一层 flex-col：
            ≥lg 时它是 display:none，于是整个布局盒子跟加它之前一模一样——
            小表格的全屏表格、时间轴那些靠 main 高度撑开的 h-full 布局一个都不会被牵连。 */}
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-sidebar px-2 pt-[env(safe-area-inset-top)] lg:hidden">
          <button
            onClick={() => setNavOpen(true)}
            aria-label="打开菜单"
            className="rounded-md p-2.5 text-foreground hover:bg-sidebar-accent/50"
          >
            <Menu className="size-5" />
          </button>
          <span className="truncate py-2.5 text-base font-semibold">{title}</span>
        </header>
        {/* 同步失败横幅：某张表推不上云时必须让她看见（见 sync.ts 的 syncFailures 注释——
            曾经云端缺列、上传每次 400，界面却一声不响，改动两天只存在本机） */}
        {syncFails.length > 0 && (
          <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            ⚠️ 有 {syncFails.length} 张表没能同步到云端（改动目前只在这台设备上）：
            {syncFails.map((f) => (
              <span key={f.table} className="ml-2 font-medium">{f.table}</span>
            ))}
            <span className="ml-2 text-xs text-amber-700">
              {syncFails[0].message.includes("column") ? "云端缺字段——把 Claude 给的那句 alter table 在 Supabase 里跑一下" : syncFails[0].message}
            </span>
          </div>
        )}
        {active ? <active.Page /> : <DashboardShell onOpenModule={setView} />}
      </main>
    </div>
  );
}

/** 导航清单。侧栏和抽屉共用一份——别再各写一遍，加模块时只会改到一处。
 *  big＝抽屉模式，行高放大到手指尺寸。 */
function NavList({
  view,
  onPick,
  big = false,
}: {
  view: string;
  onPick: (id: string) => void;
  big?: boolean;
}) {
  return (
    <nav className="flex flex-col gap-1 px-2">
      <SidebarItem
        icon={LayoutDashboard}
        label="总览"
        active={view === "dashboard"}
        big={big}
        onClick={() => onPick("dashboard")}
      />
      {modules.map(({ manifest }) => (
        <SidebarItem
          key={manifest.id}
          icon={manifest.icon}
          label={manifest.name}
          active={view === manifest.id}
          big={big}
          onClick={() => onPick(manifest.id)}
        />
      ))}
    </nav>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  active,
  big,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  big?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 transition-colors",
        big ? "py-3 text-base" : "py-2 text-sm",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50",
      )}
    >
      <Icon className={big ? "size-5" : "size-4"} />
      {label}
    </button>
  );
}
