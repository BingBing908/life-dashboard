import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
}

/**
 * 一次性烟花庆祝（canvas 画，装饰性图形别手写一长串 SVG path）。
 * 用在「**某一个领域**今日待做清空」那一刻（不是全天！一天有六七个领域，各清各的各放一次）——
 * 触发在 study-plan 的 cheer effect 里，条件是「同一领域内待做数从 >0 变成 0」，
 * 且**没有任何一条被标未完成**；有 skip 的就不放烟花，改成一句鼓励语（见 study-plan 的 CHEERS）。
 * ⚠️ 这行注释原来写的是「今日计划全部完成」，跟实现（领域级）不一致，害得文案也跟着错说成全天完成，
 *    2026-07-30 一起改正。改触发范围时记得回来同步这段。
 *
 * · 挂载那一刻**不会**放：调用方用 prevPending 守卫，否则每次打开一个已完成的领域都被炸一次
 * · 覆盖全屏但 `pointer-events-none`，不挡任何操作
 * · 尊重系统「减少动效」：勾了就完全不画，只等一下就回调
 * · 播完自己调 onDone，由调用方卸载
 */
export function Fireworks({
  onDone,
  duration = 2600,
}: {
  onDone: () => void;
  duration?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 用 ref 存回调：onDone 的身份变化不该重启动画
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      const t = window.setTimeout(() => doneRef.current(), 1400);
      return () => window.clearTimeout(t);
    }

    const cv = canvasRef.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      cv.width = window.innerWidth * dpr;
      cv.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // 用项目里各领域的颜色，跟应用是一套视觉
    const COLORS = ["#378ADD", "#1D9E75", "#D4537E", "#BA7517", "#7F77DD", "#639922"];
    let ps: Particle[] = [];

    function burst(x: number, y: number) {
      const n = 34 + Math.floor(Math.random() * 16);
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + Math.random() * 0.3;
        const sp = 1.8 + Math.random() * 3.2;
        ps.push({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0,
          max: 46 + Math.random() * 30,
          color,
        });
      }
    }

    let raf = 0;
    const t0 = performance.now();
    let nextAt = 0;

    const loop = (t: number) => {
      const el = t - t0;
      const W = window.innerWidth;
      const H = window.innerHeight;
      ctx.clearRect(0, 0, W, H);

      // 最后 700ms 不再放新的，让已有的烟花自然落尽
      if (el >= nextAt && el < duration - 700) {
        burst(W * (0.18 + Math.random() * 0.64), H * (0.16 + Math.random() * 0.36));
        nextAt = el + 240 + Math.random() * 260;
      }

      ps = ps.filter((p) => p.life < p.max);
      for (const p of ps) {
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.055; // 重力
        p.vx *= 0.99;
        p.vy *= 0.99;
        ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (el < duration) raf = requestAnimationFrame(loop);
      else doneRef.current();
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [duration]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50"
      aria-hidden="true"
    />
  );
}
