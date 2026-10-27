import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

/**
 * 注册 service worker。
 *
 * ⚠️ 为什么要有：**安卓 Chrome 的「安装应用」要求站点有一个带 fetch 处理器的 SW**，
 * 没有就只能「添加到主屏幕」做成快捷方式，不是独立 app。策略和坑都写在 `public/sw.js` 顶部。
 * ⚠️ Tauri 里不注册（桌面壳子本来就是本地文件，SW 只会添乱）；dev 也不注册，
 * 免得缓存干扰热更新。
 */
if (
  import.meta.env.PROD &&
  !("__TAURI_INTERNALS__" in window) &&
  "serviceWorker" in navigator
) {
  window.addEventListener("load", () => {
    // BASE_URL 在 GitHub Pages 上是 /life-dashboard/，SW 的作用域跟着它走
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((e) => console.warn("[sw] 注册失败（不影响使用）：", e));
  });
}
