# 录阶求职 Agent 升级开发方案

> 状态：方案确认稿，尚未实施
> 日期：2026-08-19
> 适用范围：公开本地版优先，在线版随后按浏览器存储边界适配

## 1. 结论先行

录阶第一阶段不需要再引入 LangGraph、Mastra 或 OpenAI Agents SDK。项目已经安装：

- `ai@6.0.199`
- `@ai-sdk/openai-compatible@2.0.48`
- `zod@4.4.3`

AI SDK 6 已提供第一版所需的 Agent 循环、类型化工具、多步调用、停止条件、运行时上下文、UI 消息流、工具审批和消息裁剪能力。实现聊天界面时只需补充同一生态的 `@ai-sdk/react`，不需要再叠一套 Agent 框架。

真正的工程重点不是“选哪个 Agent 框架”，而是：

1. 把录阶现有业务能力整理成输入输出稳定的工具；
2. 明确哪些操作只生成预览，哪些操作需要用户确认后写入；
3. 分离业务事实、单次对话上下文和跨对话记忆；
4. 让本地 SQLite 版与在线浏览器存储版遵守同一工具协议；
5. 验证所选模型是否真的支持稳定的工具调用，而不只验证它能返回 JSON。

这次升级属于中等偏大的功能，但不是重写项目。只做“自然语言维护投递卡片”一个闭环，约为 2 周量级；做到投递、简历、JD 和面试的完整可执行 Agent，并覆盖本地版与在线版，按一名熟悉项目的全栈开发者估算约需 4–7 周。数据关系重构未收尾会直接放大 Agent 误写数据的风险，因此必须先完成当前资料库和 Job 归属修复。

## 2. 产品形态

### 2.1 吉祥物决定

建议保留胖团子，去掉梯子和其他手持物：

- 胖团子在右下角小尺寸下更容易识别，也更有亲和力；
- 纸张角色更贴近“简历”，但容易让用户把它理解成只负责文档；
- Agent 后续会覆盖投递、JD、简历和面试，不应被一个纸张图形限制能力认知；
- “阶”不需要用梯子做字面表达，梯子会让角色姿态显得勉强。

可以保留轻微的折角或纸张边缘作为品牌暗示，但主体仍是无道具的胖团子。

### 2.2 默认态与展开态

- 默认态：团子固定在视口右下角，直接悬浮，不套圆形容器。
- 点击后：打开固定定位的浮层面板，覆盖页面内容，不改变主页面宽度，不挤压“求职阶段”等模块。
- 面板顶部：当前对话标题、新对话、历史对话、关闭。
- 首屏内容：一句能力说明和 3–4 个高频任务入口，不堆砌全部功能。
- 执行结果：优先显示结构化卡片、差异预览和确认按钮，不把所有结果都塞成大段文字。
- 大型成果：简历、JD 匹配报告和面试资料仍回到现有主工作区查看和编辑，Agent 面板只负责发起、解释和衔接。

### 2.3 第一版能力边界

第一版要实现的是“操作录阶内部数据的求职助手”，不是浏览器自动化助手。

纳入第一版：

1. 根据自然语言新增或更新投递跟进卡片；
2. 查询已有简历、岗位、投递和资料；
3. 根据口述经历生成简历修改草稿并展示差异；
4. 经用户确认后保存投递变化或简历版本；
5. 跳转到现有 JD 匹配、简历编辑和面试流程。

后续接入：

- 调用现有 JD 匹配优化；
- 生成面试准备资料；
- 发起模拟面试与复盘；
- 将多个现有流程组合成一个任务。

明确不做：

- 自动打开招聘网站；
- 自动搜索或筛选互联网岗位；
- 自动填写外部表单或代替用户投递；
- 在没有确认的情况下创建、覆盖或删除业务记录；
- 第一版就建设向量数据库、多 Agent 协作或自主长期规划。

## 3. 是否建立每次独立对话历史

建议建立独立对话，但不要把每一个按钮操作都拆成新对话。

推荐规则：

- 用户点击“新对话”时创建新线程；
- 一个目标尽量留在一个线程，例如“完善网易后端投递”和“优化通用简历”分别处理；
- 每个线程可绑定当前简历、岗位或投递记录的引用；
- 用户从具体岗位、简历或投递卡片唤起 Agent 时，自动把该对象设为本线程上下文；
- 切换线程后，不把上一线程原始消息带入新线程。

这样确实会多一层数据模型和历史列表 UI，但收益很明确：

- 不同岗位不会互相污染上下文；
- 用户能返回未完成任务；
- 工具调用和确认记录可以追溯；
- 后续做摘要、成本控制和错误恢复更容易。

Vercel AI SDK 提供 `useChat`、`UIMessage`、服务端消息 ID、消息校验和持久化回调，但不会替录阶自动提供一个托管的“对话历史数据库”。Vercel 的官方 Chatbot 模板使用 Postgres 保存历史，这是一份参考实现，不是 AI SDK 自动赠送的存储服务。录阶本地版应继续用现有 SQLite；在线版继续遵守“数据只保存在当前浏览器”的产品边界。

另外，Vercel Chat SDK 主要用于 Slack、Teams、Discord、Telegram 等外部聊天平台适配，不是录阶网页内对话历史所需的 SDK，当前不引入。

## 4. 上下文与记忆设计

不要把“记忆”理解为把全部历史消息永久塞给模型。录阶需要三层信息，每层职责不同。

### 4.1 业务事实：现有数据库是唯一真相

以下内容继续由现有业务模型保存：

- `Resume` / `ResumeVersion`
- `Job`
- `Application`
- `InterviewPreparation`
- `InterviewSession`

Agent 只通过工具按需读取，不把这些记录复制成另一套 Agent 专用长期记忆。岗位阶段、面试时间或简历正文发生变化时，数据库中的当前值优先于对话摘要。

### 4.2 线程工作记忆：完成当前任务所需的信息

每个线程保存：

- 完整 `UIMessage` 历史，用于界面回放和审计；
- 当前页面与所选业务对象的引用；
- 尚未确认的操作提案。

每次模型调用只组装：

1. 固定系统规则；
2. 当前业务对象的最小信息；
3. 最近若干条有效消息；
4. 当前任务需要的工具结果。

首版只把最近 12 条消息送入模型，较早消息继续完整保存在 SQLite 中供界面回放，不自动生成摘要。这样先解决无限增长问题，也避免额外模型调用把旧内容错误概括成“长期事实”。当真实长对话证明仅保留最近消息不足时，再为单个线程增加可见、可重建的滚动摘要；阈值集中为服务端常量，不分散在组件中。

### 4.3 跨线程长期记忆：第一版不自动建立

第一版不自动从对话中提炼“用户偏好”。原因是求职信息涉及隐私，且模型可能把一次性的岗位条件错误记成长期偏好。

未来如果确有需求，只保存用户明确确认的结构化偏好，例如：

- 目标城市；
- 目标岗位方向；
- 默认简历；
- 输出语言和表达风格。

这些偏好应可查看、修改和清除，不引入 Mem0、Letta、Supermemory 或向量数据库。录阶现有 SQLite 和结构化字段足以覆盖首版。

## 5. 推荐技术架构

```mermaid
flowchart LR
    UI[右下角团子与浮层面板] --> CHAT[AI SDK UI / useChat]
    CHAT --> API[/api/agent/chat]
    API --> AGENT[ToolLoopAgent]
    AGENT --> READ[只读业务工具]
    AGENT --> PREVIEW[变更提案工具]
    READ --> DOMAIN[现有 service / repository]
    PREVIEW --> CARD[确认卡片]
    CARD -->|用户确认| COMMIT[确定性提交命令]
    COMMIT --> DOMAIN
    DOMAIN --> DATA[(Resume / Job / Application / Interview)]
    API --> THREADS[(AgentThread / AgentMessage)]
```

核心原则：模型负责理解目标、选择工具和生成提案；真正写数据的代码仍由确定性的业务函数完成。

### 5.1 Agent 运行时

使用现有 AI SDK 6：

- `ToolLoopAgent`：统一系统规则、模型和工具；
- `tool` + Zod：声明输入和输出；
- `callOptionsSchema` / `prepareCall`：注入线程 ID、页面、语言和当前对象引用；
- `prepareStep`：裁剪上下文并限制当前步骤可用工具；
- `stopWhen: stepCountIs(...)`：避免循环失控和费用不可控；
- `createAgentUIStreamResponse`：向前端流式返回文本和工具状态；
- `InferAgentUIMessage`：保持工具结果与前端渲染类型一致；
- `onStepFinish`：记录工具名称、耗时、结果状态和 token 使用量。

第一版建议最多 6–8 步，不使用默认 20 步上限。录阶任务不是开放式互联网研究，大部分操作应在 2–4 次工具调用内完成。

### 5.2 工具不是现有 API 的重复包装

Agent 服务端工具直接调用现有 service / repository，不从服务端再请求自己的 HTTP API。API 路由、普通页面和 Agent 工具应复用同一业务函数及 Zod schema。

建议工具分三类：

| 类别 | 示例 | 是否确认 |
| --- | --- | --- |
| 读取 | 查询简历、岗位、投递、面试资料 | 不需要 |
| 生成提案 | 解析投递描述、准备简历修改、生成 JD 匹配计划 | 不需要写数据 |
| 提交变更 | 新增/更新投递、创建简历版本、保存成果 | 必须确认 |

第一版优先采用“提案 → 确认 → 确定性提交”，而不是让模型工具一调用就直接写数据库。它同时适配本地 SQLite 和在线浏览器存储，也便于用户看到将要发生什么。

## 6. 第一批工具契约

### 6.1 读取工具

#### `search_job_context`

输入：公司、岗位关键词、可选 `jobId`。
输出：最多 5 个候选 `Job`，包含 ID、公司、岗位、是否已有投递和最近更新时间。
约束：不能只靠 AI 生成的公司/岗位名称决定关联；优先使用显式 ID 和稳定 JD 指纹。

#### `get_application_context`

输入：`applicationId` 或 `jobId`。
输出：当前状态、投递日期、阶段日期、面试轮次、跟进日期、备注及关联简历 ID。

#### `get_resume_context`

输入：`resumeVersionId`。
输出：通过 `buildAiResumeSnapshot` 脱敏后的结构化简历，不返回 Logo/base64、编辑器设置或内部元数据。

### 6.2 投递提案工具

#### `prepare_application_change`

处理示例：

> “昨天投了网易后端，下周二一面。”

输出必须是结构化提案：

```ts
type ApplicationChangeProposal = {
  action: "create" | "update";
  matchedJobId: string | null;
  matchedApplicationId: string | null;
  company: string;
  title: string;
  status: ApplicationStatus;
  interviewRound: InterviewRound;
  appliedAt: string | null;
  stageDate: string | null;
  nextFollowUpAt: string | null;
  notes: string;
  assumptions: string[];
  missingFields: string[];
};
```

规则：

- 相对日期必须转换为绝对日期并显示给用户；
- 同时出现“已投递”和“将面试”时，保留真实投递日期，并把当前状态设为面试；
- 公司或岗位有多个候选时先让用户选择；
- 不要求用户必须提供 JD 才能建立最小岗位身份；
- 不自动创建外部投递，不把“准备投递”误记为“已投递”。

确认卡片应展示“原值 → 新值”。用户确认后再调用确定性的 `commit_application_change`，提交时重新校验目标记录，避免确认期间数据已经变化。

### 6.3 简历提案工具

#### `prepare_resume_patch`

输入：目标 `resumeVersionId`、用户口述事实、希望修改的模块。
输出：字段级补丁、修改理由、仍需用户补充的事实、前后差异。
约束：不能编造公司、学校、项目、技能、时间、数字或结果；没有足够事实时只追问，不提交空泛改写。

#### `commit_resume_patch`

经确认后创建新版本，默认不覆盖原简历。复用现有简历规范化、版本命名和事实保护逻辑。

### 6.4 后续工具

- `prepare_jd_match`
- `create_tailored_resume_version`
- `create_interview_preparation`
- `start_mock_interview`
- `open_artifact`

这些工具应在现有页面流程稳定之后逐个接入，不能一次性把全部业务改造成 Agent 专用实现。

## 7. 对话持久化

### 7.1 公开本地版

新增两张最小表，不修改已发布 migration：

```prisma
model AgentThread {
  id        String   @id @default(cuid())
  title     String
  summary   String   @default("")
  context   Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  messages AgentMessage[]

  @@index([updatedAt])
}

model AgentMessage {
  id        String   @id
  sequence  Int
  payload   Json
  createdAt DateTime @default(now())

  threadId String
  thread   AgentThread @relation(fields: [threadId], references: [id], onDelete: Cascade)

  @@unique([threadId, sequence])
  @@index([threadId])
}
```

`payload` 保存完整 `UIMessage`，而不是只保存发给模型的 `ModelMessage`。从数据库恢复后必须通过 `validateUIMessages` 按当前工具 schema 校验；旧消息结构不兼容时应安全降级为只读历史，不能直接让模型执行其中的旧工具调用。

`context` 只保存当前页面和业务对象 ID。它不建立外键，原因是删除业务资料后仍应保留对话历史；每次使用这些 ID 时重新查询，找不到就标记为失效引用。

### 7.2 在线版

在线版不得把对话写入服务器 SQLite。使用单独的浏览器 key，例如：

```text
lujie-careerkit:agent:v1
```

保存相同的线程和消息 DTO，只在一轮生成完成后写入，不在每个 token 到达时重写 localStorage。首版设置可解释的数量上限并提供删除历史入口；达到容量上限时先提示用户清理或导出，不静默删除。

在线版业务写入由浏览器中的确定性提交命令完成。服务端 Agent 接收经过 Zod 校验的最小上下文快照，只返回操作提案，不能直接访问或假装访问用户浏览器中的全部数据。

## 8. 模型兼容与安全边界

### 8.1 工具能力检测

现有设置页只验证模型能否生成 JSON，不足以证明它能稳定调用工具。Agent 上线前增加一次轻量能力检测：

1. 要求模型调用一个无副作用测试工具；
2. 验证工具名和 Zod 输入；
3. 验证工具结果能回到下一步并生成最终回答；
4. 失败时明确提示“当前模型不支持录阶 Agent 工具调用”，而不是把错误伪装成普通回答。

AI SDK 统一了 Provider API，但无法保证所有 OpenAI-compatible 服务、本地模型和模型版本都实现相同质量的 function calling。

### 8.2 操作分级

| 风险级别 | 操作 | 行为 |
| --- | --- | --- |
| 低 | 查询、汇总、跳转、生成草稿 | 自动执行 |
| 中 | 新增投递、更新阶段、创建简历版本 | 展示差异后确认 |
| 高 | 删除资料、覆盖内容、批量修改 | 第一版不开放；后续二次确认 |
| 外部 | 自动投递、发消息、浏览器控制 | 当前不开放 |

系统提示词不能代替权限控制。确认要求必须落在工具或提交命令层，不能只写一句“请先询问用户”。

### 8.3 隐私与日志

- 简历进入模型前继续使用 `buildAiResumeSnapshot`；
- 工具日志只记录工具名、业务 ID、耗时、状态和错误类型，不记录完整简历、JD、API Key 或消息正文；
- Agent 消息和工具输入均视为不可信输入，服务端必须用 Zod 校验；
- 工具返回面向模型的最小结果，避免把整份数据库状态反复放入上下文；
- 不默认接入将对话上传到第三方的 tracing 或记忆服务。

## 9. 推荐文件结构

先保持少文件，实际变大后再拆：

```text
src/components/agent/
  agent-assistant.tsx          # 团子、浮层、历史列表、消息与确认卡片

src/lib/agent/
  agent.ts                     # ToolLoopAgent、系统规则、循环控制
  tools.ts                     # Zod 工具与提案结构
  context.ts                   # 线程摘要、业务上下文和消息裁剪

src/app/api/agent/
  chat/route.ts
  threads/route.ts
  threads/[id]/route.ts

src/lib/
  agent-store.ts               # 本地版线程/消息持久化
```

在线版复用消息 DTO、Agent UI、工具 schema 和提案提交逻辑，只替换线程存储和业务提交入口。不要为每个工具新增一条独立 API 路由。

## 10. 分阶段实施

### 阶段 0：先完成数据关系收尾，3–5 天

- 完成资料库整档/单项删除语义；
- 修复 Job 稳定归属和 JD 指纹；
- 修复面试资料的岗位归属；
- 验证已有 Application 不会被资料删除误伤。

Agent 写工具依赖这些边界，不能跳过。

### 阶段 1：Agent 基础与投递闭环，7–10 天

- 团子默认态和覆盖式浮层；
- 独立线程、历史列表、创建/切换/删除对话；
- `ToolLoopAgent`、流式消息和工具状态 UI；
- 读取岗位/投递上下文；
- 自然语言生成投递变更提案；
- 确认后新增或更新 Application；
- 模型工具能力检测；
- 本地版测试和真实交互验证。

### 阶段 2：简历编辑闭环，5–8 天

- 口述经历追问；
- 结构化简历补丁；
- 事实边界校验；
- 前后差异和确认；
- 创建独立简历版本；
- 从 Agent 跳转到简历编辑器继续调整。

### 阶段 3：接入 JD 与面试，5–8 天

- 复用现有 JD 匹配与简历优化服务；
- 复用面试准备与模拟面试服务；
- 通过业务 ID 串联成果；
- 只让 Agent 编排已有稳定能力，不复制提示词和保存逻辑。

### 阶段 4：在线版适配与稳健性，5–9 天

- 浏览器对话存储；
- 最小上下文快照；
- 浏览器端确认和提交；
- localStorage 容量、刷新恢复和多标签页行为；
- 中英文文案；
- 回归、构建和移动端交互验证。

以上估算包含实现和针对性验证，不包含浏览器自动投递、外部岗位搜索、云端账号同步或多设备历史同步。

## 11. 测试与完成标准

至少覆盖：

1. 两个对话绑定不同岗位时上下文不串线；
2. “昨天投递、下周二一面”等相对日期能显示绝对日期后再确认；
3. 同一岗位不会重复创建 Job 或 Application；
4. 多个同名岗位时必须询问，不能猜测；
5. 用户拒绝确认时数据库没有任何变化；
6. 提交前目标记录已变化时停止并重新生成差异；
7. 简历修改不新增原简历不存在的事实；
8. 删除岗位或简历后，旧线程能打开并正确显示引用已失效；
9. 历史消息恢复后通过当前工具 schema 校验；
10. 不支持工具调用的模型得到清晰提示；
11. Agent 循环达到步数上限时安全停止；
12. 公开版 SQLite 与在线版浏览器存储分别完成真实行为验证。

发布前仍需执行全量 Vitest、ESLint、TypeScript/Next.js 生产构建，并真实操作两个首发闭环。

## 12. 框架调研结论

| 方案 | 能力 | 对录阶的代价 | 结论 |
| --- | --- | --- | --- |
| Vercel AI SDK 6 | Provider 无关、ToolLoopAgent、工具、流式 UI、审批、消息裁剪 | 记忆语义和持久化仍由应用设计 | 采用；项目已安装 |
| OpenAI Agents SDK TS | 小型抽象、Session、HITL、Guardrail、Tracing、多 Agent | 新增第二套运行时；非 OpenAI 模型虽可接 AI SDK 适配器，但收益与现有能力重叠 | 暂不采用 |
| LangGraph.js | Checkpoint、可恢复图、Interrupt、长期任务、时间旅行 | 心智模型、状态图和持久化更重 | 只有出现跨小时/跨天可恢复工作流时再评估 |
| Mastra | Agent、Workflow、Memory、RAG、Evals、Observability 一体化 | 引入较大框架面并重复现有 Provider、存储和业务结构 | 更适合绿地项目，当前不采用 |
| VoltAgent | TypeScript Agent、Workflow、Memory、Observability 与 MCP | 核心包本身仍带来一套完整 Agent 运行时，与现有 AI SDK 能力和录阶存储边界重复 | 小而完整，但不是本项目当前最小增量 |
| TanStack AI | Headless UI、工具、审批、持久化与多 Provider Adapter | 更像 AI SDK 的替代层而不是补充层；生态仍新，迁移会重写现有 AI 路由 | 继续观察，不在这次升级中替换稳定底座 |
| BeeAI Framework | Agent、Workflow、Memory、工具与遥测 | 框架维护方已明确不再继续维护，且会引入自己的运行时 | 排除 |
| Vercel Chat SDK | 多聊天平台 Adapter 与 Bot 状态 | 解决 Slack/Teams/Discord 等渠道，不解决当前网页内助手核心问题 | 当前不采用 |

如果未来出现以下任意两个条件，再重新评估 LangGraph 或 Mastra：

- 任务需要运行数小时或数天；
- 服务重启后必须从中间步骤恢复；
- 有复杂并行分支、补偿事务和人工审批队列；
- 多 Agent 协作成为核心产品能力；
- 需要专门的 Agent 运维平台，而不仅是应用日志和评测。

在此之前，现有 AI SDK + 录阶自己的业务工具系统是最简单、风险最低、最符合项目架构的方案。

### 12.1 宠物交互方案

Codex 的宠物并非完全不可参考：OpenAI 公开仓库包含 TUI 宠物的资源包下载、动画状态、内置目录和环境动作实现，官方 Skills 仓库也公开了 8×9 精灵图契约。但桌面应用中负责浮动 WebView 展示和交互的完整渲染层，目前没有在公开仓库中找到，不能把 Codex 桌面宠物当作一个可直接安装的前端组件。

现有开源项目中，与录阶网页形态最接近的是 `gibbon/agent-pet`：Apache-2.0、React 18+、无运行时依赖，支持拖动、localStorage 位置持久化、九种动画状态和自定义精灵图。不过它自带悬浮容器、气泡和状态 API，会与录阶已经实现的 Agent 面板重复；项目本身也较新。当前不新增依赖，只复用其已验证的交互思路，用浏览器原生 Pointer Events、CSS 动画和 localStorage 接入现有面板。

`pixelpets` 提供看向鼠标、拖拽、抚摸、打字/滚动反应和 Agent 状态联动，互动性更丰富，但它是 Electron 全屏透明桌面应用，不适合直接嵌入 Next.js 页面。它可作为以后丰富动作和情绪状态的产品参考，不作为本次运行时依赖。

当前宠物形态与行为边界：

- 保留已有胖团子/纸张混合形象 `public/brand/lujie-agent.svg`，不覆盖资产；
- 新增独立纸团子候选 `public/brand/lujie-agent-paper-v1.png`，确认形象后再决定是否替换默认皮肤；
- 宠物默认只显示本体，点击才打开覆盖式面板，不改变页面布局；
- 本体可拖动并记住位置，拖动结束不会误打开面板；
- 空闲时轻微呼吸，思考时加快动作，鼠标移动时有轻微朝向反馈；
- 系统开启“减少动态效果”时停用循环动画和鼠标追随；
- 首版不引入完整精灵图运行时。只有确认需要挥手、行走、睡眠、成功/失败等逐帧动作时，再评估接入 `agent-pet` 或按 Codex 图集契约制作独立动作包。

## 13. 主要一手资料

- [Vercel AI SDK：Agents](https://ai-sdk.dev/docs/agents)
- [Vercel AI SDK：Building Agents](https://ai-sdk.dev/docs/agents/building-agents)
- [Vercel AI SDK：Loop Control](https://ai-sdk.dev/docs/agents/loop-control)
- [Vercel AI SDK：Memory](https://ai-sdk.dev/docs/agents/memory)
- [Vercel AI SDK：Chatbot Message Persistence](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence)
- [Vercel AI SDK：Tool Usage and Approval](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage)
- [Vercel 官方 Chatbot 模板](https://github.com/vercel/chatbot)
- [Vercel Chat SDK](https://github.com/vercel/chat)
- [OpenAI Agents SDK TypeScript](https://openai.github.io/openai-agents-js/)
- [OpenAI Agents SDK：Sessions](https://openai.github.io/openai-agents-js/guides/sessions/)
- [OpenAI Agents SDK：Human in the Loop](https://openai.github.io/openai-agents-js/guides/human-in-the-loop/)
- [LangGraph.js](https://github.com/langchain-ai/langgraphjs)
- [LangGraph：Persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence)
- [LangGraph：Interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts)
- [Mastra](https://github.com/mastra-ai/mastra)
- [VoltAgent](https://github.com/VoltAgent/voltagent)
- [TanStack AI](https://tanstack.com/ai/latest)
- [BeeAI Framework](https://github.com/i-am-bee/beeai-framework)
- [OpenAI Codex：宠物资源包](https://github.com/openai/codex/blob/main/codex-rs/tui/src/pets/asset_pack.rs)
- [OpenAI Codex：宠物动画模型](https://github.com/openai/codex/blob/main/codex-rs/tui/src/pets/model.rs)
- [OpenAI Codex：环境动作](https://github.com/openai/codex/blob/main/codex-rs/tui/src/pets/ambient.rs)
- [OpenAI Skills：Codex 宠物图集契约](https://github.com/openai/skills/blob/main/skills/.curated/hatch-pet/references/codex-pet-contract.md)
- [agent-pet：网页 Agent 宠物组件](https://github.com/gibbon/agent-pet)
- [pixelpets：Electron 互动桌面宠物](https://github.com/JOhnsonKC201/pixelpets)
