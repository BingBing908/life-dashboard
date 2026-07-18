import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onSave: (next: string) => void;
  className?: string;
  inputClassName?: string;
  /** 占位（值为空时显示） */
  placeholder?: string;
}

/**
 * 点击文字即可就地编辑：点一下变输入框，回车或失焦保存，Esc 取消。
 * 保存空字符串会被忽略（还原原值）。
 */
export function EditableText({
  value,
  onSave,
  className,
  inputClassName,
  placeholder,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commit() {
    const next = draft.trim();
    if (next && next !== value) onSave(next);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={cn(
          "min-w-0 rounded-sm border border-primary/50 bg-background px-1 outline-none ring-1 ring-primary/30",
          inputClassName,
        )}
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      title="点击修改"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          setDraft(value);
          setEditing(true);
        }
      }}
      className={cn("cursor-text", className)}
    >
      {value || <span className="text-muted-foreground">{placeholder}</span>}
    </span>
  );
}
