import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 通用折叠区：一行标题（可带条数/提示 + 右侧操作），点击展开/收起。
 * 待办的「历史已完成」「今天的学练计划」、学练计划的历史等复用它。
 */
export function Collapse({
  title,
  count,
  hint,
  defaultOpen = false,
  right,
  children,
}: {
  title: string;
  count?: number;
  hint?: ReactNode;
  defaultOpen?: boolean;
  right?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-90")} />
          <span className="shrink-0">
            {title}
            {count != null && `（${count}）`}
          </span>
          {hint && <span className="truncate text-[11px] font-normal text-muted-foreground/70">{hint}</span>}
        </button>
        {right}
      </div>
      {open && <div className="mt-1.5">{children}</div>}
    </div>
  );
}
