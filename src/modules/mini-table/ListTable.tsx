import { useEffect, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { READ_BODY } from "@/lib/ui";
import type { MiniTable } from "./data";
import { type ListCell, type ListSource } from "./sources";

/**
 * 清单型表格（2026-08-21 加）：**只读**，几列并排，每格点开看详情。
 *
 * 为什么单独一个组件、不塞进 `TableDetail`：那边是「可编辑的自定义列表格」——
 * 加行/加列/四种单元格编辑器/存 `mini_table_rows`。这边一件都不需要：
 * **数据实时算、不落库、不可编辑**。硬塞进去会把两套逻辑缠在一起。
 * 判据：`LIST_SOURCES[table.id]` 存在就走这里，否则走 TableDetail。
 *
 * ⚠️ 行数＝最长那一列；短的列后面留空。**别去"对齐"三列**——
 * 第 3 条谚语和第 3 首古诗之间没有任何关系，它们只是并排，不是同一行的数据。
 */
export function ListTable({
  table,
  source,
  onBack,
}: {
  table: MiniTable;
  source: ListSource;
  onBack: () => void;
}) {
  const [data, setData] = useState<Record<string, ListCell[]> | null>(null);
  const [open, setOpen] = useState<{ col: string; cell: ListCell } | null>(null);

  useEffect(() => {
    source.compute().then(setData).catch(() => setData({}));
  }, [source]);

  const cols = source.columns;
  const rowCount = data ? Math.max(0, ...cols.map((c) => (data[c.id] ?? []).length)) : 0;
  const total = data ? cols.reduce((n, c) => n + (data[c.id] ?? []).length, 0) : 0;

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-3 flex shrink-0 items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">{table.name}</h1>
          <p className="text-xs text-muted-foreground">
            共 {total} 条
            {cols.map((c) => ` · ${c.name} ${(data?.[c.id] ?? []).length}`).join("")}
          </p>
        </div>
      </div>
      {source.note && (
        <p className="mb-3 shrink-0 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          {source.note}
        </p>
      )}

      {/* 表格区自己滚、表头吸顶（跟 TableDetail 同一套版式语言） */}
      <div className="min-h-0 flex-1 overflow-auto rounded-xl border">
        <table className="w-full table-fixed border-collapse">
          <thead className="sticky top-0 z-10 bg-card">
            <tr>
              {cols.map((c) => (
                <th key={c.id} className="border-b border-r px-3 py-2 text-left last:border-r-0">
                  <div className="text-sm font-semibold">
                    {c.name}
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      {(data?.[c.id] ?? []).length}
                    </span>
                  </div>
                  {c.hint && <div className="text-[11px] font-normal text-muted-foreground">{c.hint}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data === null && (
              <tr>
                <td colSpan={cols.length} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  读取中…
                </td>
              </tr>
            )}
            {data !== null &&
              Array.from({ length: rowCount }, (_, r) => (
                <tr key={r} className="align-top">
                  {cols.map((c) => {
                    const cell = (data[c.id] ?? [])[r];
                    return (
                      <td key={c.id} className="border-b border-r p-0 last:border-r-0">
                        {cell ? (
                          <button
                            onClick={() => setOpen({ col: c.name, cell })}
                            className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-accent/50"
                          >
                            <span className="w-6 shrink-0 text-xs tabular-nums text-muted-foreground">
                              {r + 1}
                            </span>
                            <span className="min-w-0 flex-1 break-words text-sm">
                              {cell.text}
                              {/* 流派这类小标签直接显示在格子里——Rosie 要它是为了
                                  「一眼看出偏了哪派」，藏进弹窗就得点开七次才数得出来 */}
                              {cell.tag && (
                                <span className="ml-1.5 whitespace-nowrap rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                  {cell.tag}
                                </span>
                              )}
                            </span>
                            {cell.badge && (
                              <span
                                className={cn(
                                  "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                                  cell.badge === "✓"
                                    ? "bg-emerald-500 text-white"
                                    : "border text-muted-foreground",
                                )}
                                title="复习进度（五次全过＝毕业）"
                              >
                                {cell.badge}
                              </span>
                            )}
                          </button>
                        ) : (
                          <div className="px-3 py-2.5">&nbsp;</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            {data !== null && rowCount === 0 && (
              <tr>
                <td colSpan={cols.length} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  还没有内容。日日学更新后这里会自动出现。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 详情弹窗：一层半透明底罩 + 居中卡片。点底罩或 ✕ 关闭 */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
          onClick={() => setOpen(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-xl border bg-card p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  {open.col}
                  {open.cell.tag && ` · ${open.cell.tag}`}
                  {open.cell.date && ` · 学于 ${open.cell.date}`}
                  {open.cell.badge && ` · 复习 ${open.cell.badge === "✓" ? "已毕业" : open.cell.badge}`}
                </p>
                <h2 className="break-words text-lg font-semibold">{open.cell.text}</h2>
              </div>
              <button
                onClick={() => setOpen(null)}
                className="ml-auto shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent"
                title="关闭"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className={cn("whitespace-pre-wrap text-foreground/90", READ_BODY)}>{open.cell.detail}</p>
          </div>
        </div>
      )}
    </div>
  );
}
