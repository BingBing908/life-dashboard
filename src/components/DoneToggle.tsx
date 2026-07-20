import { cn } from "@/lib/utils";

/**
 * 计划项的完成状态开关：两个按钮【已完成】【未完成】，替代原来的单个方框勾。
 * 底层仍是「切换」语义——只有点击会改变当前状态的那个按钮才触发 onToggle：
 *   · 点【已完成】：仅当当前未完成、且允许完成(canComplete)时切换
 *   · 点【未完成】：仅当当前已完成时切换
 * 全应用「计划」处共用（学练计划今日卡片 / 一周列表 / 待办页镜像），别再各写一份。
 */
export function DoneToggle({
  done,
  canComplete = true,
  onToggle,
  size = "md",
  disabledHint,
}: {
  done: boolean;
  /** 门控：为 false 时禁用【已完成】（如英语/学习需先写「做了什么」） */
  canComplete?: boolean;
  onToggle: () => void;
  size?: "sm" | "md";
  /** canComplete 为 false 时鼠标悬停在【已完成】上的提示 */
  disabledHint?: string;
}) {
  const pad = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
  return (
    <div className="inline-flex shrink-0 overflow-hidden rounded-md border">
      <button
        type="button"
        disabled={!done && !canComplete}
        title={!done && !canComplete ? disabledHint : undefined}
        onClick={() => {
          if (!done && canComplete) onToggle();
        }}
        className={cn(
          pad,
          "font-medium transition-colors",
          done
            ? "bg-emerald-500 text-white"
            : canComplete
              ? "bg-background text-muted-foreground hover:bg-accent"
              : "cursor-not-allowed bg-background text-muted-foreground/40",
        )}
      >
        已完成
      </button>
      <button
        type="button"
        onClick={() => {
          if (done) onToggle();
        }}
        className={cn(
          pad,
          "border-l font-medium transition-colors",
          !done ? "bg-muted text-foreground" : "bg-background text-muted-foreground hover:bg-accent",
        )}
      >
        未完成
      </button>
    </div>
  );
}
