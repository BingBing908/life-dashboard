import { cn } from "@/lib/utils";

export type PlanState = "pending" | "done" | "skip";

/**
 * 计划项的三态开关：两个按钮【已完成】【未完成(今天做不了)】。
 *   · 初始「待做」(pending)：两个按钮都不高亮
 *   · 点【已完成】→ done（绿）；再点一次撤销回 pending
 *   · 点【未完成】→ skip（琥珀，＝今天做不了）；再点一次撤销回 pending
 * 「已决定」(done/skip) 的项由调用方排到列表下方，上方只留待做项。
 * 全应用「计划」处共用（学练计划今日卡片 / 一周列表 / 待办页镜像），别再各写一份。
 */
export function DoneToggle({
  state,
  canComplete = true,
  onDone,
  onSkip,
  onClear,
  size = "md",
  disabledHint,
}: {
  state: PlanState;
  /** 门控：false 时禁用【已完成】（如英语/学习需先写「做了什么」） */
  canComplete?: boolean;
  onDone: () => void;
  onSkip: () => void;
  onClear: () => void;
  size?: "sm" | "md";
  disabledHint?: string;
}) {
  const pad = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
  const isDone = state === "done";
  const isSkip = state === "skip";
  return (
    <div className="inline-flex shrink-0 overflow-hidden rounded-md border">
      <button
        type="button"
        disabled={!isDone && !canComplete}
        title={!isDone && !canComplete ? disabledHint : undefined}
        onClick={() => (isDone ? onClear() : canComplete && onDone())}
        className={cn(
          pad,
          "font-medium transition-colors",
          isDone
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
        onClick={() => (isSkip ? onClear() : onSkip())}
        className={cn(
          pad,
          "border-l font-medium transition-colors",
          isSkip
            ? "bg-amber-500 text-white"
            : "bg-background text-muted-foreground hover:bg-accent",
        )}
      >
        未完成
      </button>
    </div>
  );
}
