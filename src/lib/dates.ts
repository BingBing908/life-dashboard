/** 本地时区的 YYYY-MM-DD */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

/** b − a 的天数差（"2026-07-01" → "2026-07-03" ＝ 2；a 晚于 b 为负） */
export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(b + "T00:00:00") - Date.parse(a + "T00:00:00");
  return Math.round(ms / 86_400_000); // round 掉夏令时那一小时
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** "2026-07-17" -> "7月17日 周五" */
export function formatDateCn(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}月${d.getDate()}日 周${WEEKDAYS[d.getDay()]}`;
}

/** 所在周的周一（周日算上一周的） */
export function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const dow = d.getDay(); // 0=周日
  return addDays(dateStr, dow === 0 ? -6 : 1 - dow);
}
