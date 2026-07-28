import { useEffect, useState } from "react";
import { Plus, Table2, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AppModule } from "../types";
import {
  createTable,
  deleteTable,
  listTables,
  rowCounts,
  type MiniColumn,
  type MiniTable,
} from "./data";
import { TABLE_SOURCES } from "./sources";
import { TableDetail } from "./TableDetail";

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
  const bound = !!TABLE_SOURCES[table.id];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="group flex min-h-36 cursor-pointer flex-col gap-3 rounded-xl border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Table2 className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{table.name}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {rows === undefined ? "…" : `${rows} 行`} · {table.columns.length} 列
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
          点开全屏编辑 →
        </span>
      </div>
    </div>
  );
}

function Page() {
  const [tables, setTables] = useState<MiniTable[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    listTables().then(setTables);
    rowCounts().then(setCounts).catch(() => {});
  }, []);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    const t = await createTable(name);
    setTables((ts) => [...ts, t]);
    setNewName("");
    setActiveId(t.id);
  }

  async function handleDelete(id: string) {
    setTables((ts) => ts.filter((t) => t.id !== id));
    await deleteTable(id);
  }

  function handleColumnsChange(id: string, columns: MiniColumn[]) {
    setTables((ts) => ts.map((t) => (t.id === id ? { ...t, columns } : t)));
  }

  const active = tables.find((t) => t.id === activeId);
  if (active) {
    return (
      <TableDetail
        table={active}
        onBack={() => setActiveId(null)}
        onColumnsChange={(cols) => handleColumnsChange(active.id, cols)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tables.map((t) => (
          <TableTile
            key={t.id}
            table={t}
            rows={counts[t.id] ?? 0}
            onOpen={() => setActiveId(t.id)}
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
