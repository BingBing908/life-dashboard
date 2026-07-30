/**
 * 全应用统一的「卡片规格」——单一来源，别再各页手写。
 *
 * 2026-07-29 以**饮食页**为样板定稿（Rosie：「这大小刚刚好，全部模块都默认这么大」）。
 * 在此之前各页是散的：圆角有 lg/xl 两种、内边距有 p-2.5/p-3/p-4/p-5 四种、
 * 底色有的 bg-card 有的 bg-background 有的没有、标题有的在卡内有的在卡外——
 * 眼睛读不出层级，观感就是「不和谐」。
 *
 * 两级层次，只有两级：
 *   CARD    ＝ 页面上的一块（白底、border、rounded-xl、p-4），**标题放卡内**
 *   SUBCARD ＝ 卡内的一小块（浅一层灰底、rounded-lg、更小的 padding）
 * 小块里的输入框记得加 `bg-card`，否则在灰底上浮不起来。
 *
 * ⚠️ 例外（不要"统一"掉）：带 accent 边框的功能面板（默写框、作业框、经期提示）
 * 保持 rounded-lg + 自己的配色——它们是**卡内**的东西，比卡小一号才对。
 *
 * 用法：`className={CARD}` 或 `className={cn(CARD, "额外的类")}`。
 */

/** 页面根容器：全宽 + 统一留白（宽度约定见 CLAUDE.md，别加 max-w） */
export const PAGE = "space-y-6 p-6";

/** 一块卡片 */
export const CARD = "rounded-xl border bg-card p-4";

/** 可点击的卡片（磁贴、跳转块） */
export const CARD_BTN =
  "rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/40";

/** 卡内的一小块 */
export const SUBCARD = "rounded-lg bg-muted px-3 py-2.5";

/** 卡标题（放在卡内，不要飘在卡外） */
export const CARD_TITLE = "text-lg font-semibold";

/** 卡副标题／说明行 */
export const CARD_SUB = "text-sm text-muted-foreground";

/**
 * 两栏布局：窄屏（< lg）自动塞成一栏，宽屏按 1.18 : 1 分。
 * ⚠️ 必须用 minmax(0, …) 而不是裸 fr——否则长内容会把栏撑破、整页横向滚动。
 */
export const TWO_COL =
  "grid gap-6 lg:grid-cols-[minmax(0,1.18fr)_minmax(0,1fr)]";

/**
 * 阅读型正文（2026-07-30 加，Rosie：「日日学现在的文字都太小了，阅读起来对眼睛很不友好」）。
 *
 * ⚠️⚠️ **密度按用途分，别用同一套字号伺候两种页面**：
 *   - **仪表型**（总览 / 饮食 / 小表格）＝目标是「一屏看完」，字小、行密才装得下；
 *   - **阅读型**（日日学的内容、作业框、精读文章）＝目标是「连着看十分钟不累」，
 *     字要大一档、行距要松。她的历史长传一条上千字，用 14px/1.625 读确实伤眼。
 * 想同时满足两者是不可能的，所以刻意分成两套。**别把这两个常量"统一"回 text-sm。**
 *
 * 只用在**内容**上，不要用在界面元件（徽标、按钮、日期头、磁贴预览）——
 * 那些是 chrome，跟着界面字号走；磁贴里的预览还是 line-clamp 的，放大反而看得更少。
 */
export const READ_BODY = "text-[15.5px] leading-[1.9]";

/** 阅读型标题（条目标题。原来跟正文同为 text-sm，压不出层级） */
export const READ_TITLE = "text-base font-semibold";
