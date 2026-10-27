import { useEffect, useState } from "react";

/**
 * 订阅一个 CSS 媒体查询，窗口变化时跟着变。
 *
 * ⚠️ **能用 Tailwind 断点类解决的，就别用这个。** 它只适合那些「布局要换一种算法」
 * 的地方——比如日程周历：宽屏七列并排、手机一次只渲染一天，这是两套 JSX，
 * 不是同一套 JSX 换几个 class，CSS 断点做不到。
 *
 * 断点值跟 Tailwind 对齐：sm 640 / md 768 / lg 1024 / xl 1280。
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange(); // query 变了要立刻重新取一次，别等下一次窗口变化
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
