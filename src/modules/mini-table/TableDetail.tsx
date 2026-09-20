import { useEffect, useState } from "react";
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { addDays, mondayOf, todayStr } from "@/lib/dates";
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
import { TABLE_SOURCES, weekDatesOf, weekNoOf } from "./sources";
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

const fmtMD = (d: string) => d.slice(5).replace("-", "/");

export function TableDetail({ table, onBack, onColumnsChange }: Props) {
  const [rows, setRows] = useState<MiniRow[]>([]);
  const columns = table.columns;
  const source = TABLE_SOURCES[table.id]; // 绑定了数据源的表（如三餐/时间轴周表）
  const [auto, setAuto] = useState<Record<string, Record<string, string>>>({});
  // 周表回看（2026-09-20 Rosie：要能翻到生成之后的每一周）：weekMon＝当前显示的那周的周一
  const curMon = mondayOf(todayStr());
  const [weekMon, setWeekMon] = useState(curMon);
  const isCurWeek = weekMon === curMon;
  const weekDates = weekDatesOf(weekMon);

  useEffect(() => {
    listRows(table.id).then(setRows);
  }, [table.id]);

  useEffect(() => {
    if (!source) {
      setAuto({});
      return;
    }
    source.compute(weekDatesOf(weekMon)).then(setAuto).catch(() => {});
  }, [table.id, source, weekMon]);

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
    // 打开即占满整屏：整体撑满 main 的高度，表格区域自己滚（表头吸顶）
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex shrink-0 items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">{table.name}</h1>
          <p className="text-xs text-muted-foreground">
            {rows.length} 行 · {columns.length} 列
            {source && " · 浅色格＝自动来自 饮食 / 时间轴 / 日日学，不用手填"}
          </p>
        </div>
        <div className="ml-auto flex shrink-0 gap-2">
          <AddColumnButton onAdd={handleAddColumn} />
          <Button size="sm" onClick={handleAddRow}>
            <Plus className="size-4" /> 加一行
          </Button>
        </div>
      </div>

      {/* 周导航（只有绑定数据源的周表有）：◀▶ 逐周翻、📅 像苹果日历那样先选月/年再点周 */}
      {source && (
        <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="outline" size="icon-sm" title="上一周" onClick={() => setWeekMon(addDays(weekMon, -7))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-medium tabular-nums">
            {weekNoOf(weekMon) >= 1 ? `第 ${weekNoOf(weekMon)} 周 · ` : ""}
            {fmtMD(weekDates[0])}–{fmtMD(weekDates[6])}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            title="下一周"
            disabled={isCurWeek}
            onClick={() => setWeekMon(addDays(weekMon, 7))}
          >
            <ChevronRight className="size-4" />
          </Button>
          <WeekPicker value={weekMon} max={curMon} onPick={setWeekMon} />
          {!isCurWeek && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setWeekMon(curMon)}>
                回本周
              </Button>
              <span className="text-xs text-muted-foreground">
                回看模式：自动行按所选周计算；手填行不分周（显示当前内容，只读）
              </span>
            </>
          )}
        </div>
      )}

      {/* min-h-0 让 flex 子项能真正缩；内层 table-container 变成滚动容器，表头才吸得住 */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-card [&>[data-slot=table-container]]:h-full [&>[data-slot=table-container]]:overflow-auto">
        {/* h-full：让浏览器把剩余高度按比例摊给各行，表格顶到底、不留大片空白。
            行数多到超出高度时 height:100% 退化成下限，照旧滚动。 */}
        <Table className="h-full text-base">
          <TableHeader className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_var(--border)]">
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.id} className="group h-12 min-w-40 px-3">
                  <span className="flex items-center gap-1">
                    {col.name}
                    {source && source.dayCols.includes(col.id) && (
                      <span className="text-[11px] font-normal tabular-nums text-muted-foreground">
                        {fmtMD(weekDates[source.dayCols.indexOf(col.id)])}
                      </span>
                    )}
                    <button
                      className="invisible text-muted-foreground hover:text-destructive group-hover:visible"
                      title="删除此列"
                      onClick={() => handleDeleteColumn(col.id)}
                    >
                      <Trash2 className="size-3.5" />
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
                    // 长内容换行而不是把整列撑宽（否则一格长文本挤扁其余六天）。
                    // h-px 是让子元素 h-full 生效的老招：表格 h-full 摊高度后，td 的
                    // 实际高度覆盖这 1px，而子元素的 100% 就有了可解析的参照。
                    <TableCell key={col.id} className="h-px max-w-72 p-1.5 align-top whitespace-normal break-words">
                      {isAuto ? (
                        <div
                          className="h-full min-h-14 rounded bg-muted/40 px-3 py-2 text-sm leading-relaxed text-muted-foreground"
                          title="自动来自源模块（饮食 / 时间轴 / 日日学）"
                        >
                          {auto[label!]?.[col.id] || "—"}
                        </div>
                      ) : source && !isCurWeek ? (
                        // 回看模式手填格只读：mini_table_rows 的手填值不分周，改了会污染当前周
                        <div className="h-full min-h-14 px-3 py-2 text-sm text-muted-foreground/70" title="手填行不分周，回看时只读">
                          {row.data[col.id] === true ? "✓" : String(row.data[col.id] ?? "") || "—"}
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
                <TableCell className="p-1.5 text-center align-top">
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
                  className="h-24 text-center text-muted-foreground"
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

/** 周选择器（2026-09-20，Rosie：「像苹果日历一样可以选一月/一年来回顾」）：
 *  📅 弹层默认按月列出该月覆盖的周（点周跳表），点标题升到年（12 个月钻回月）。
 *  未来的周禁用（还没发生，没得回顾）。 */
function WeekPicker({ value, max, onPick }: { value: string; max: string; onPick: (mon: string) => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"month" | "year">("month");
  const [ym, setYm] = useState(value.slice(0, 7)); // "YYYY-MM"
  const year = Number(ym.slice(0, 4));
  const shiftMonth = (n: number) => {
    const d = new Date(year, Number(ym.slice(5, 7)) - 1 + n, 1);
    setYm(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  // 该月覆盖的周（以周一代表）：从含 1 号的那周起，最多 6 周，周一超出当月为止
  const weeks: string[] = [];
  let m = mondayOf(`${ym}-01`);
  for (let i = 0; i < 6; i++) {
    if (m.slice(0, 7) > ym) break;
    weeks.push(m);
    m = addDays(m, 7);
  }
  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setMode("month");
          setYm(value.slice(0, 7));
        }
      }}
    >
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" title="选一周回顾">
            <Calendar className="size-4" /> 选周
          </Button>
        }
      />
      <PopoverContent className="w-64 space-y-2">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon-sm" onClick={() => (mode === "month" ? shiftMonth(-1) : setYm(`${year - 1}${ym.slice(4)}`))}>
            <ChevronLeft className="size-4" />
          </Button>
          <button
            className="rounded-md px-2 py-0.5 text-sm font-medium hover:bg-accent"
            onClick={() => setMode(mode === "month" ? "year" : "month")}
            title={mode === "month" ? "点击切到全年选月" : "点击回到本月"}
          >
            {mode === "month" ? `${year} 年 ${Number(ym.slice(5, 7))} 月` : `${year} 年`}
          </button>
          <Button variant="ghost" size="icon-sm" onClick={() => (mode === "month" ? shiftMonth(1) : setYm(`${year + 1}${ym.slice(4)}`))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {mode === "year" ? (
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 12 }, (_, i) => (
              <Button
                key={i}
                variant={Number(ym.slice(5, 7)) === i + 1 ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setYm(`${year}-${String(i + 1).padStart(2, "0")}`);
                  setMode("month");
                }}
              >
                {i + 1} 月
              </Button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {weeks.map((w) => (
              <Button
                key={w}
                variant={w === value ? "secondary" : "ghost"}
                size="sm"
                className="justify-between tabular-nums"
                disabled={w > max}
                onClick={() => {
                  onPick(w);
                  setOpen(false);
                }}
              >
                <span>{weekNoOf(w) >= 1 ? `第 ${weekNoOf(w)} 周` : "—"}</span>
                <span className="text-muted-foreground">
                  {fmtMD(w)}–{fmtMD(addDays(w, 6))}
                </span>
              </Button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
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
