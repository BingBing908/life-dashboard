import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MiniColumn } from "./data";

interface CellProps {
  column: MiniColumn;
  value: unknown;
  onChange: (v: unknown) => void;
}

/** 根据列类型渲染对应的单元格编辑器 */
export function Cell({ column, value, onChange }: CellProps) {
  switch (column.type) {
    case "checkbox":
      return (
        <div className="flex justify-center">
          <Checkbox
            checked={Boolean(value)}
            onCheckedChange={(v) => onChange(v === true)}
          />
        </div>
      );
    case "number":
      return (
        <Input
          type="number"
          className="h-8 border-transparent bg-transparent shadow-none focus-visible:border-input"
          value={value == null ? "" : String(value)}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
        />
      );
    case "date":
      return (
        <Input
          type="date"
          className="h-8 border-transparent bg-transparent shadow-none focus-visible:border-input"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );
    case "select":
      return (
        <Select
          value={typeof value === "string" ? value : ""}
          onValueChange={(v) => onChange(v)}
        >
          <SelectTrigger className="h-8 border-transparent bg-transparent shadow-none">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {(column.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    default:
      return (
        <Input
          className="h-8 border-transparent bg-transparent shadow-none focus-visible:border-input"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
