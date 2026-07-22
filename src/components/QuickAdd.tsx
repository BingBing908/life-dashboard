import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 通用「加一行」输入框（输入框 + 按钮），自带输入 state，回车或点按钮提交后清空。
 * 哪里要「加一条」就调它，别再各写一份内联输入框。
 * 模块顶层组件（自带 state），不会因父组件重渲染失焦。
 */
export function QuickAdd({
  placeholder,
  cta = "加",
  onAdd,
  variant = "default",
}: {
  placeholder: string;
  cta?: string;
  onAdd: (text: string) => void;
  variant?: "default" | "outline";
}) {
  const [v, setV] = useState("");
  const submit = () => {
    const t = v.trim();
    if (!t) return;
    onAdd(t);
    setV("");
  };
  return (
    <div className="flex gap-2">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder={placeholder}
        className="h-9 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary/40"
      />
      <Button size="sm" variant={variant} onClick={submit}>
        <Plus className="size-4" /> {cta}
      </Button>
    </div>
  );
}
