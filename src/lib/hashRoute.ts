import { useCallback, useEffect, useState } from "react";

/**
 * 模块内位置进 URL 的公共实现。
 *
 * **约定（2026-07-28 Rosie 定，适用于所有模块）**：凡是模块内部会「换页」的状态
 * ——列表→详情（小表格的某张表、日日学的某本书）、板块切换、今日/一周这类 tab
 * ——都必须写进 hash 子路径，绝不能只存在组件 state 里。否则刷新、误触后退、
 * 从别处跳回来都会被弹回模块首页（她的原话：「老是一刷新就回外面了」）。
 *
 * 路径形状：`#/<模块id>/<段1>/<段2>…`。App.tsx 的 parseHash 只取第一段认模块，
 * 后面的段归模块自己解析，所以模块想放几段就放几段。
 *
 * 新模块只要用 `useSubPath(模块id)` 拿到 [段数组, 跳转函数]，别再各写一份
 * hashchange 监听。
 */

/** 读当前 hash 里属于该模块的子路径段（`#/mini-table/abc` → `["abc"]`） */
export function readSubPath(moduleId: string): string[] {
  const segs = window.location.hash
    .replace(/^#\/?/, "")
    .split("/")
    .filter(Boolean);
  if (segs[0] !== moduleId) return [];
  return segs.slice(1).map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s; // 手输的畸形 % 转义别让整页崩
    }
  });
}

/** 写子路径（空数组＝回模块首页） */
export function writeSubPath(moduleId: string, sub: string[]): void {
  const tail = sub.filter(Boolean).map(encodeURIComponent).join("/");
  window.location.hash = tail ? `/${moduleId}/${tail}` : `/${moduleId}`;
}

/**
 * 把模块内位置挂到 hash 上：返回 `[子路径段, 跳转]`。
 * 跳转即改 hash（浏览器前进/后退因此天然可用），hashchange 再同步回状态。
 */
export function useSubPath(
  moduleId: string,
): [string[], (sub: string[]) => void] {
  const [sub, setSub] = useState<string[]>(() => readSubPath(moduleId));

  useEffect(() => {
    const onHash = () =>
      // 同值就返回原数组，免得 writeSubPath 触发的 hashchange 白重渲染一次
      setSub((prev) => {
        const next = readSubPath(moduleId);
        return prev.join("/") === next.join("/") ? prev : next;
      });
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [moduleId]);

  const nav = useCallback(
    (next: string[]) => {
      writeSubPath(moduleId, next);
      setSub(next);
    },
    [moduleId],
  );

  return [sub, nav];
}
