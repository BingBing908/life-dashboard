import { useEffect, useState } from "react";
import { Plus, Table2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card as UiCard, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AppModule } from "../types";
import {
  createTable,
  deleteTable,
  listTables,
  type MiniColumn,
  type MiniTable,
} from "./data";
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

function Page() {
  const [tables, setTables] = useState<MiniTable[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    listTables().then(setTables);
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
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-semibold">小表格</h1>

      <div className="mb-6 flex max-w-sm gap-2">
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tables.map((t) => (
          <UiCard
            key={t.id}
            role="button"
            tabIndex={0}
            className="group cursor-pointer transition-colors hover:bg-accent/50"
            onClick={() => setActiveId(t.id)}
            onKeyDown={(e) => e.key === "Enter" && setActiveId(t.id)}
          >
            <CardHeader className="flex flex-row items-center gap-2">
              <Table2 className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">{t.name}</CardTitle>
              <button
                className="invisible ml-auto text-muted-foreground hover:text-destructive group-hover:visible"
                title="删除表格"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(t.id);
                }}
              >
                <Trash2 className="size-4" />
              </button>
            </CardHeader>
          </UiCard>
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
