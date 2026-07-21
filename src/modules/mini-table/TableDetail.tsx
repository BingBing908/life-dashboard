import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Cell } from "./cells";
import { TABLE_SOURCES, currentWeekDates } from "./sources";
import {
  addRow,
  deleteRow,
  listRows,
  updateColumns,
  updateRowData,
  type ColumnType,
  type MiniColumn,
  type MiniRow,
  type MiniTable,
} from "./data";

const COLUMN_TYPES: { value: ColumnType; label: string }[] = [
  { value: "text", label: "文本" },
  { value: "number", label: "数字" },
  { value: "checkbox", label: "勾选" },
  { value: "date", label: "日期" },
  { value: "select", label: "单选" },
];

interface Props {
  table: MiniTable;
  onBack: () => void;
  onColumnsChange: (cols: MiniColumn[]) => void;
}

export function TableDetail({ table, onBack, onColumnsChange }: Props) {
  const [rows, setRows] = useState<MiniRow[]>([]);
  const columns = table.columns;
  const source = TABLE_SOURCES[table.id]; // 绑定了数据源的表（如三餐/运动）
  const [auto, setAuto] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    listRows(table.id).then(setRows);
  }, [table.id]);

  useEffect(() => {
    if (!source) {
      setAuto({});
      return;
    }
    source.compute(currentWeekDates()).then(setAuto).catch(() => {});
  }, [table.id, source]);

  async function handleAddRow() {
    const row = await addRow(table.id);
    setRows((rs) => [...rs, row]);
  }

  async function handleCellChange(row: MiniRow, colId: string, v: unknown) {
    const data = { ...row.data, [colId]: v };
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, data } : r)));
    await updateRowData(row.id, data);
  }

  async function handleDeleteRow(rowId: string) {
    setRows((rs) => rs.filter((r) => r.id !== rowId));
    await deleteRow(rowId);
  }

  async function handleAddColumn(col: MiniColumn) {
    const next = [...columns, col];
    onColumnsChange(next);
    await updateColumns(table.id, next);
  }

  async function handleDeleteColumn(colId: string) {
    const next = columns.filter((c) => c.id !== colId);
    onColumnsChange(next);
    await updateColumns(table.id, next);
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-2xl font-semibold">{table.name}</h1>
        <div className="ml-auto flex gap-2">
          <AddColumnButton onAdd={handleAddColumn} />
          <Button size="sm" onClick={handleAddRow}>
            <Plus className="size-4" /> 加一行
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.id} className="group min-w-32">
                  <span className="flex items-center gap-1">
                    {col.name}
                    <button
                      className="invisible text-muted-foreground hover:text-destructive group-hover:visible"
                      title="删除此列"
                      onClick={() => handleDeleteColumn(col.id)}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </span>
                </TableHead>
              ))}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="group">
                {columns.map((col) => {
                  const label = source ? (row.data[source.itemCol] as string | undefined) : undefined;
                  const isAuto =
                    !!source &&
                    !!label &&
                    source.autoItems.includes(label) &&
                    source.dayCols.includes(col.id);
                  return (
                    <TableCell key={col.id} className="p-1">
                      {isAuto ? (
                        <div
                          className="rounded bg-muted/40 px-2 py-1.5 text-sm text-muted-foreground"
                          title="自动来自源模块（饮食 / 学练计划）"
                        >
                          {auto[label!]?.[col.id] || "—"}
                        </div>
                      ) : (
                        <Cell
                          column={col}
                          value={row.data[col.id]}
                          onChange={(v) => handleCellChange(row, col.id, v)}
                        />
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className="p-1 text-center">
                  <button
                    className="invisible text-muted-foreground hover:text-destructive group-hover:visible"
                    title="删除此行"
                    onClick={() => handleDeleteRow(row.id)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="h-20 text-center text-muted-foreground"
                >
                  还没有数据，点击右上角「加一行」开始
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function AddColumnButton({ onAdd }: { onAdd: (col: MiniColumn) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ColumnType>("text");
  const [options, setOptions] = useState("");

  function submit() {
    if (!name.trim()) return;
    onAdd({
      id: crypto.randomUUID(),
      name: name.trim(),
      type,
      options:
        type === "select"
          ? options.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
          : undefined,
    });
    setName("");
    setType("text");
    setOptions("");
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <Plus className="size-4" /> 加一列
          </Button>
        }
      />
      <PopoverContent className="w-64 space-y-3">
        <div className="space-y-1.5">
          <Label>列名</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="例如：书名"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label>类型</Label>
          <Select value={type} onValueChange={(v) => setType(v as ColumnType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLUMN_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {type === "select" && (
          <div className="space-y-1.5">
            <Label>选项（逗号分隔）</Label>
            <Input
              value={options}
              onChange={(e) => setOptions(e.target.value)}
              placeholder="例如：想读, 在读, 读完"
            />
          </div>
        )}
        <Button className="w-full" size="sm" onClick={submit}>
          添加
        </Button>
      </PopoverContent>
    </Popover>
  );
}
