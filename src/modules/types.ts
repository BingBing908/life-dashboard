import type { ComponentType } from "react";

/** 仪表盘卡片尺寸：占用的网格列数/行数 */
export interface ModuleSize {
  w: 1 | 2;
  h: 1 | 2;
}

export interface ModuleManifest {
  /** 唯一标识，也用作路由 key */
  id: string;
  /** 侧边栏与卡片标题 */
  name: string;
  icon: ComponentType<{ className?: string }>;
  description?: string;
  defaultSize?: ModuleSize;
}

/**
 * 应用模块接口：仪表盘壳子只依赖这个形状。
 * Card = 仪表盘首页上的摘要小组件；Page = 点进去的完整功能页。
 */
export interface AppModule {
  manifest: ModuleManifest;
  Card: ComponentType;
  Page: ComponentType;
}
