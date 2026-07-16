import type { AppModule } from "./types";
import planner from "./planner";
import studyLog from "./study-log";
import habitCheckin from "./habit-checkin";
import miniTable from "./mini-table";

/** 所有已启用的模块。新增模块只需在这里注册一行。 */
export const modules: AppModule[] = [planner, studyLog, habitCheckin, miniTable];

export function getModule(id: string): AppModule | undefined {
  return modules.find((m) => m.manifest.id === id);
}
