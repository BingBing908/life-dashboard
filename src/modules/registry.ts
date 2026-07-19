import type { AppModule } from "./types";
import todo from "./todo";
import studyPlan from "./study-plan";
import supplement from "./supplement";
import studyLog from "./study-log";
import miniTable from "./mini-table";

/** 所有已启用的模块。新增模块只需在这里注册一行。 */
// 注：打卡（habit-checkin）已并入 To Do List 页面右栏，不再单独注册；
// 想拆回独立模块时把它加回这个数组即可。
// 「此刻」时间轴已并入学练计划的「今天」页，不再作为独立模块。
export const modules: AppModule[] = [studyPlan, todo, supplement, studyLog, miniTable];

export function getModule(id: string): AppModule | undefined {
  return modules.find((m) => m.manifest.id === id);
}
