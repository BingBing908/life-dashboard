import type { AppModule } from "./types";
import planner from "./planner";
import todo from "./todo";
import studyLog from "./study-log";
import miniTable from "./mini-table";

/** 所有已启用的模块。新增模块只需在这里注册一行。 */
// 注：打卡（habit-checkin）已并入 To Do List 页面右栏，不再单独注册；
// 想拆回独立模块时把它加回这个数组即可。
export const modules: AppModule[] = [planner, todo, studyLog, miniTable];

export function getModule(id: string): AppModule | undefined {
  return modules.find((m) => m.manifest.id === id);
}
