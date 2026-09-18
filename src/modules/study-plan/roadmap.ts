/**
 * 冲刺路线的阶段配置（2026-09-01 加）：从现在到 2027 年 3–4 月面试窗口的分段计划。
 *
 * ⚠️⚠️ **形态＝「阶段目标 + 进度指针」，刻意不是「预排到周的课表」**。
 * Copilot 给过一版「22 周 × 每周排到第几课」的方案，被否了，理由跟这个项目一贯的
 * 取向相同（PRODUCT.md 设计取向第一条）：她是复健期学习者，**固定流程 + 进度指针、
 * 不赶日期**。预排「第 7 周看第 12 课」只要慢半课整表失真、然后被无视。
 * 所以每个阶段只写「目标是什么、达标长什么样」，**进度由她在界面里自己写**
 * （「实际做了什么」，存 app_settings 的 `roadmap:<id>:note`，见 data.ts）。
 *
 * ⚠️ **计划文案在这里当代码常量维护（不入库）**：方向是 Claude 出的，改方向改代码即可；
 * 她写的 note/status 才需要跨设备同步，那部分在库里。两边职责分开——
 * 这就是她要的「模块化：有计划，允许我在计划后写入实际做了什么」。
 *
 * 阶段划分的依据（2026-09-01 那次重定向对话）：她的短板不是 AI 理论而是
 * ①词汇体系（会做叫不出名字）②把 Abuse 项目讲成 PM 语言。所以每个阶段都有一条
 * 「讲自己的项目」的输出目标，光看课不算达标。
 */

export interface RoadmapStage {
  id: string;
  /** 大致时间范围——是**指引**不是死线，写「约」就是这个意思 */
  period: string;
  title: string;
  /** 这个阶段要拿到什么（目标，尽量写成可验收的） */
  goals: string[];
  /** 达标判据：一句能自查的话 */
  done: string;
}

export const ROADMAP_STAGES: RoadmapStage[] = [
  {
    id: "s1-map",
    period: "约 9 月",
    title: "知识地图 + 项目翻译起步",
    goals: [
      "AI 术语卡按 JD 高频词清单推进（RAG / Embedding / Evaluation 优先），每张都接自己项目的实例",
      "每天一道「项目翻译」题：把 Abuse / Zenith 的一个决策讲出理由",
      "开始读《金字塔原理》（书架里已放）",
    ],
    done: "能把「我做了什么」用 PM 的词说出来：分类体系、评测、ROI、幂等、脱敏各对应我项目里的哪件事",
  },
  {
    id: "s2-rag",
    period: "约 10 月",
    title: "RAG 吃透",
    goals: [
      "看完 RAG 相关课程段落：Chunk / Embedding / 向量库 / Retrieval / ReRank / 评测",
      "输出一份「企业知识库」设计（拿 Abuse 知识库或 NOC 知识库当场景）：一张架构图 + 两页产品文档",
    ],
    done: "能回答「为什么 RAG 而不是微调」，并有一份自己场景的知识库设计拿得出手",
  },
  {
    id: "s3-agent",
    period: "约 11 月",
    title: "Agent 体系",
    goals: [
      "Agent / Tool Calling / Memory / Planning / Multi-Agent 的概念过一遍",
      "把 Abuse 流水线用 Agent 的语言重新描述一遍（它本来就是 agent workflow，缺的只是叫法）",
      "设计一个「AI Alert Copilot」：告警 → 分析 → 历史检索 → 根因建议（最贴 NOC 背景的作品）",
    ],
    done: "能讲清 Abuse 流水线里哪些环节是 Agent、哪些是确定性逻辑、为什么这么分",
  },
  {
    id: "s4-platform",
    period: "约 12 月",
    title: "Dify / MCP 系统化 + 项目补强",
    goals: [
      "把已经会用的 Dify 系统化：什么时候选 Workflow、什么时候选 Agent、为什么不用纯代码",
      "MCP 已有基础（7/29 术语卡 + 作业），补到能设计：给 life-dashboard 或 Zenith 写一份 MCP 工具设计",
      "NOC Sentinel / life-dashboard 两个项目按「能写进简历」的标准查漏补缺",
    ],
    done: "两个项目都能按「用户-问题-方案-效果」四段讲完，各有一个量化数字",
  },
  {
    id: "s5-pm",
    period: "约 1 月",
    title: "产品方法论收口",
    goals: [
      "PRD / Roadmap / 优先级 / 北极星复习一遍（大部分概念课已讲过，这次串成体系）",
      "把 Abuse 项目写成一页正式的「产品案例」：问题发现 → 方案 → 评测 → ROI（55k 邮件 / 26k case / 1.3-1.5 FTE 全放进去）",
    ],
    done: "那一页案例给一个不懂网络的 PM 看，他能在五分钟内明白你做了什么、值多少",
  },
  {
    id: "s6-interview",
    period: "约 2 月",
    title: "简历 + 面试准备",
    goals: [
      "简历重写：标题不再是 Support Engineer，写 AI 自动化项目负责人的语言",
      "高频 20 题逐题过：每题用自己项目的实例回答，不背定义",
      "模拟面试至少 3 轮（我来当面试官，按 AI 平台 PM 的路数问）",
    ],
    done: "自我介绍 90 秒版脱口而出，且里面没有「我只是做 support 的」这类自贬",
  },
  {
    id: "s7-apply",
    period: "3–4 月",
    title: "投递与面试",
    goals: ["投 AI 平台 / 中台 / AIOps / Agent / AI 安全 PM", "每场面试后记录被问住的题，回来补"],
    done: "拿到 offer，或至少三场终面——两者都算这半年成了",
  },
];
