import { useEffect, useState } from "react";
import { LayoutDashboard, MoreHorizontal, X } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { modules, getModule } from "@/modules/registry";
import { cn } from "@/lib/utils";
import { getPersistError } from "@/lib/db";
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
 * 窄屏底部标签栏固定放这四个 + 一个「更多」。
 *
 * 为什么是底部标签栏：Rosie 要求「做成手机 app 爱用的格式」，而底部 tab 是手机 app
 * 最标志性的结构——拇指够得到，切换不用先开抽屉。选这四个的依据是她的真实使用频率：
 * 日日学是唯一长期跑得动的（完成率 84%）、时间轴和日程是她在家要看的「现在干什么/这周怎么排」。
 * 待办/饮食/小表格/书架都在工作时间用电脑，收进「更多」。
 * ⚠️ 改这里只要动这个数组；「更多」永远是抽屉，抽屉里仍是全部模块。
 */
const TAB_IDS = ["dashboard", "study-plan", "schedule", "study-log"];

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
  // 本地库写不进去（配额满/隐私模式）——比同步失败更严重：这台设备上也没留下
  const [persistErr, setPersistErr] = useState<string | null>(null);
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
      if (alive) {
        setSyncFails(getSyncFailures());
        setPersistErr(getPersistError());
      }
    });
    const timeout = new Promise((r) => setTimeout(r, bootTimeoutMs()));
    Promise.race([initial, timeout]).then(() => {
      if (alive) setBooting(false);
    });

    const readFails = () => {
      setSyncFails(getSyncFailures());
      setPersistErr(getPersistError());
    };

    /**
     * **定时后台同步：只推拉数据、不 bump**（原规矩，保留）。
     * 页面开着的时候重挂载会打断正在进行的操作（默写打到一半）、把人弹回板块首页。
     */
    const tick = () => runSync().then(readFails);

    /**
     * ⚠️⚠️ **回到前台时必须 bump**（2026-10-28 加，修她报的「iPad 上点的进度手机上看不到」）。
     *
     * 原来**所有**后台同步都不 bump，那条规矩是给「电脑上开一整天」设计的：页面一直亮着，
     * 重挂载纯属打扰。但手机/iPad 装成 app 之后，**打开 app ＝ 恢复那个还活着的页面，不是重新加载**
     * ⇒ 同步确实把别的设备的改动拉进了本地 SQLite，**React 却还拿着旧的内存数据** ⇒
     * 她在 iPad 上点完、回手机一看还是老样子，看起来就像「没同步」。
     * **回到前台这一刻她必然不在打字**，所以这里 bump 是安全的——原规矩想保护的场景不存在。
     *
     * ⚠️ 判据用 `visibilitychange`，不能只靠 `focus`：手机上切 app / 锁屏解锁
     * 未必触发 window 的 focus，而 visibilitychange 是移动端唯一可靠的那个。
     */
    const onResume = () =>
      runSync().then((changed) => {
        readFails();
        bump(changed);
      });

    const onVisibility = () => {
      if (document.visibilityState === "visible") onResume();
      // 切走的那一刻再推一次：手机会冻结/回收后台页面，不趁现在推就得等下次打开
      else void runSync();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onResume);
    const iv = setInterval(tick, 30_000);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onResume);
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
      <main
        key={syncTick}
        className="min-w-0 flex-1 overflow-y-auto pb-[calc(3.75rem+env(safe-area-inset-bottom))] lg:pb-0"
      >
        {/* 窄屏顶栏：汉堡 ＋ 当前页名。
            ⚠️ 刻意放在 main **里面**做吸顶条，而不是在外面再包一层 flex-col：
            ≥lg 时它是 display:none，于是整个布局盒子跟加它之前一模一样——
            小表格的全屏表格、时间轴那些靠 main 高度撑开的 h-full 布局一个都不会被牵连。 */}
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-sidebar px-4 pt-[env(safe-area-inset-top)] lg:hidden">
          <span className="truncate py-3 text-base font-semibold">{title}</span>
        </header>
        {/* ⚠️ 本地存盘失败：比同步失败更严重——**这次改动连这台设备都没留下**，
            刷新就没了。原来这个错误是定时器里的未捕获异常，界面上一点声音都没有。 */}
        {persistErr && (
          <div className="border-b border-red-300 bg-red-50 px-4 py-2 text-sm text-red-900">
            ⚠️ 这台设备存不下数据了，刚才的改动<b>没有保存</b>（{persistErr}）。
            别继续在这台设备上录入——先去电脑上操作，并把这条告诉 Claude。
          </div>
        )}
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

      {/* 窄屏底部标签栏（≥lg 隐藏，那边有常驻侧栏）。
          ⚠️ fixed 定位是对视口的，不受 main 的滚动影响——所以 main 要留出等高的 padding-bottom。 */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-sidebar pb-[env(safe-area-inset-bottom)] lg:hidden">
        {TAB_IDS.map((id) => {
          const m = getModule(id);
          const Icon = id === "dashboard" ? LayoutDashboard : m!.manifest.icon;
          const label = id === "dashboard" ? "总览" : m!.manifest.name;
          const on = view === id;
          return (
            <button
              key={id}
              onClick={() => setView(id)}
              className={cn(
                "flex min-w-0 flex-1 touch-manipulation flex-col items-center gap-0.5 py-2",
                on ? "text-primary" : "text-sidebar-foreground/60",
              )}
            >
              <Icon className="size-5" />
              <span className="truncate text-[11px]">{label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setNavOpen(true)}
          className={cn(
            "flex min-w-0 flex-1 touch-manipulation flex-col items-center gap-0.5 py-2",
            TAB_IDS.includes(view) ? "text-sidebar-foreground/60" : "text-primary",
          )}
        >
          <MoreHorizontal className="size-5" />
          <span className="truncate text-[11px]">更多</span>
        </button>
      </nav>
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
