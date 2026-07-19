/**
 * 打开外部链接：桌面端(Tauri)用系统浏览器，网页端开新标签。
 * 全应用共用，别在各模块里各写一份。
 */
export async function openLink(url: string): Promise<void> {
  if ("__TAURI_INTERNALS__" in window) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      return;
    } catch {
      // 权限不足等情况回退到 window.open
    }
  }
  window.open(url, "_blank", "noopener");
}
