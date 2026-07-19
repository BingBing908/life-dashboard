import type { AppModule } from "./types";
import focus from "./focus";
import todo from "./todo";
import studyPlan from "./study-plan";
import supplement from "./supplement";
import studyLog from "./study-log";
import miniTable from "./mini-table";

/** 所有已启用的模块。新增模块只需在这里注册一行。 */
// 注：打卡（habit-checkin）已并入 To Do List 页面右栏，不再单独注册；
// 想拆回独立模块时把它加回这个数组即可。
// focus（此刻）放首位：按时间自动聚合各领域，是日常主入口。
export const modules: AppModule[] = [focus, todo, studyPlan, supplement, studyLog, miniTable];

export function getModule(id: string): AppModule | undefined {
  return modules.find((m) => m.manifest.id === id);
}
