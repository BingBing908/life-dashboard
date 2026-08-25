import { useEffect, useState } from "react";
import { Plus, Table2, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CARD_BTN, CARD_TITLE, PAGE } from "@/lib/ui";
import { useSubPath } from "@/lib/hashRoute";
import type { AppModule } from "../types";
import {
  createTable,
  deleteTable,
  listTables,
  rowCounts,
  type MiniColumn,
  type MiniTable,
} from "./data";
import { LIST_SOURCES, TABLE_SOURCES, WORD_TABLE_ID } from "./sources";
import { TableDetail } from "./TableDetail";
import { ListTable } from "./ListTable";
import { WordTable } from "./WordTable";

function Card() {
  const [tables, setTables] = useState<MiniTable[] | null>(null);

  useEffect(() => {
    listTables().then(setTables).catch(() => setTables([]));
  }, []);

  if (tables === null)
    return <p className="text-sm text-muted-foreground">加载中…</p>;
  if (tables.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        随手建小表格：读书清单、体重记录……
      </p>
    );
  return (
    <div className="text-sm text-muted-foreground">
      共 {tables.length} 张表：{tables.slice(0, 3).map((t) => t.name).join("、")}
      {tables.length > 3 && " 等"}
    </div>
  );
}

/** 列表页的表格磁贴（含内容的组件放模块顶层，避免父组件重渲染时失焦） */
function TableTile({
  table,
  rows,
  onOpen,
  onDelete,
}: {
  table: MiniTable;
  rows: number | undefined;
  onOpen: () => void;
  onDelete: () => void;
}) {
  // 清单型表和单词表都不落库（行是实时算的），`rows` 查出来永远是 0——
  // 直接显示「0 行」会误导，所以这两类改显示内容概要（2026-08-21）。
  const listSrc = LIST_SOURCES[table.id];
  const isWords = table.id === WORD_TABLE_ID;
  const live = !!listSrc || isWords;
  const bound = !!TABLE_SOURCES[table.id] || live;
  // hover 语言归 `CARD_BTN` 统一管（2026-07-30）：原来这里是「描边+阴影」、总览完成度卡是
  // 「只有底色」、饮食页跳转块是「描边+底色」，三套可点卡片点起来手感不一样。布局类照旧往后加。
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className={cn(CARD_BTN, "group flex min-h-36 cursor-pointer flex-col gap-3")}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Table2 className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("truncate", CARD_TITLE)}>{table.name}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isWords
              ? "各篇精读的生词 · 单击看释义、双击标熟"
              : listSrc
                ? listSrc.columns.map((c) => c.name).join(" · ")
                : `${rows === undefined ? "…" : `${rows} 行`} · ${table.columns.length} 列`}
          </p>
        </div>
        <button
          className="invisible shrink-0 text-muted-foreground hover:text-destructive group-hover:visible"
          title="删除表格"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="mt-auto flex items-center gap-2">
        {bound && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">
            <Zap className="size-3" /> 自动填
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          {live ? "点开浏览 →" : "点开全屏编辑 →"}
        </span>
      </div>
    </div>
  );
}

function Page() {
  const [tables, setTables] = useState<MiniTable[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  // 打开哪张表进 URL（#/mini-table/<表id>）：在表里刷新不再被弹回列表
  const [sub, nav] = useSubPath("mini-table");
  const activeId = sub[0] ?? null;
  const [newName, setNewName] = useState("");

  useEffect(() => {
    listTables()
      .then(setTables)
      .finally(() => setLoaded(true));
    rowCounts().then(setCounts).catch(() => {});
  }, []);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    const t = await createTable(name);
    setTables((ts) => [...ts, t]);
    setNewName("");
    nav([t.id]);
  }

  async function handleDelete(id: string) {
    setTables((ts) => ts.filter((t) => t.id !== id));
    if (id === activeId) nav([]);
    await deleteTable(id);
  }

  function handleColumnsChange(id: string, columns: MiniColumn[]) {
    setTables((ts) => ts.map((t) => (t.id === id ? { ...t, columns } : t)));
  }

  const active = tables.find((t) => t.id === activeId);
  if (active) {
    // 清单型表（只读、实时算、点格看详情）走 ListTable；其余走可编辑的 TableDetail。
    // 判据就是 LIST_SOURCES 里有没有这张表，见 sources.ts 顶部注释。
    // 单词表形态特殊（散铺的词 + 单击看释义 / 双击标熟），单独一个渲染器
    if (active.id === WORD_TABLE_ID) {
      return <WordTable table={active} onBack={() => nav([])} />;
    }
    const listSrc = LIST_SOURCES[active.id];
    if (listSrc) {
      return <ListTable table={active} source={listSrc} onBack={() => nav([])} />;
    }
    return (
      <TableDetail
        table={active}
        onBack={() => nav([])}
        onColumnsChange={(cols) => handleColumnsChange(active.id, cols)}
      />
    );
  }
  // 带着表 id 进来但表还没读出来：别闪一下列表再跳详情
  if (activeId && !loaded) {
    return <p className="p-6 text-sm text-muted-foreground">加载中…</p>;
  }

  return (
    <div className={PAGE}>
      <div className="mb-1 flex items-baseline gap-3">
        <h1 className="text-2xl font-semibold">小表格</h1>
        <span className="text-sm text-muted-foreground">周/月复盘中枢 · 点开即全屏</span>
      </div>

      <div className="mb-6 mt-4 flex max-w-md gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="新表格名称，如：读书清单"
        />
        <Button onClick={handleCreate}>
          <Plus className="size-4" /> 建表
        </Button>
      </div>

      {/* 页面改全宽后加一档 2xl:4 列，免得宽屏上磁贴被拉成大长条 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {tables.map((t) => (
          <TableTile
            key={t.id}
            table={t}
            rows={counts[t.id] ?? 0}
            onOpen={() => nav([t.id])}
            onDelete={() => handleDelete(t.id)}
          />
        ))}
      </div>

      {tables.length === 0 && (
        <p className="mt-8 text-muted-foreground">
          还没有表格。在上方输入名称建第一张表，比如「读书清单」「体重记录」。
        </p>
      )}
    </div>
  );
}

const miniTableModule: AppModule = {
  manifest: {
    id: "mini-table",
    name: "小表格",
    icon: Table2,
    description: "自定义列的轻量表格",
    defaultSize: { w: 1, h: 1 },
  },
  Card,
  Page,
};

export default miniTableModule;
