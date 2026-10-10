# 录阶求职 Agent 升级开发方案

> 状态：本地版已有 11 个工具契约；保留完整轮次预算、写工具结果精简和线程保存冲突保护，已加固审批续接并阻止同一次确认被重复执行。结构化摘要与对象绑定尚未实现，按实际需求决定是否接入
> 最近更新：2026-10-03；在 `8b0c36d` 基线上补齐审批执行前保护及本地后端验收
> 适用范围：本轮只修改公开本地版；在线版需另行适配、验证，不代表已部署

## 1. 结论先行

录阶第一阶段不需要再引入 LangGraph、Mastra 或 OpenAI Agents SDK。项目已经安装：

- `ai@6.0.199`
- `@ai-sdk/openai-compatible@2.0.48`
- `@ai-sdk/react@3.0.201`
- `streamdown@2.5.0` 与 `@streamdown/cjk@1.0.3`
- `zod@4.4.3`

AI SDK 6 已提供第一版所需的 Agent 循环、类型化工具、多步调用、停止条件、运行时上下文、UI 消息流、工具审批和消息裁剪能力。聊天界面已补充同一生态的 `@ai-sdk/react`，并使用 Streamdown 正确渲染流式 Markdown，不需要再叠一套 Agent 框架。

真正的工程重点不是“选哪个 Agent 框架”，而是：

1. 把录阶现有业务能力整理成输入输出稳定的工具；
2. 明确哪些操作只生成预览，哪些操作需要用户确认后写入；
3. 分离业务事实、单次对话上下文和跨对话记忆；
4. 让本地 SQLite 版与在线浏览器存储版遵守同一工具协议；
5. 验证所选模型是否真的支持稳定的工具调用，而不只验证它能返回 JSON。

2026-10-02 复核：工具闭环已存在，后文候选设计不再作为必须逐项完成的排期。当前优先保证审批参数不可被替换、写入目标正确和已有链路可验证；结构化摘要、对象绑定、控制中心工具和长期记忆各自需要实际使用问题支持。资料库和 Job 归属问题应在业务层修复，再由 Agent 复用，避免为 Agent 单独建立一套业务规则。

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

### 2.3 当前能力与下一步边界

当前本地版已经是“能操作录阶内部数据的实验性求职助手”，不是只有聊天和投递卡片的早期原型。它已支持：

1. 搜索 `Job` 及其可选 `Application`，并按名称、学校、技能、项目等检索简历；
2. 按精确 ID 读取完整脱敏简历；
3. 经确认后新增或更新投递卡片；
4. 根据用户明确提供的经历创建独立简历；
5. 选择优化参数后生成并保存 JD 定制简历；
6. 选择准备重点后生成并保存面试资料；
7. 选择模式后创建模拟面试题目和会话；
8. 只修改指定简历的视觉模板；
9. 从结果卡片打开简历编辑器、求职资料库或模拟面试工作区。

下一阶段不再重复增加已有能力，而是补齐：

- “口述经历 → 草稿预览/差异 → 确认保存”的更细粒度事实校验；
- 现有简历内容的受控局部编辑，而不只是新建、JD 定制和换模板；
- 长对话的完整轮次裁剪、结构化摘要和任务状态；
- 仅在用户询问整体进度时按需读取控制中心摘要；
- 在线版浏览器存储与客户端确认执行；
- 模型工具能力探针、Token/缓存与工具调用观测。

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

每个线程继续保存完整 `UIMessage` 历史，用于界面回放、审批恢复和审计。本地版已移除最近 12 条消息的固定截取：模型输入按完整用户轮次和约 12K Token 的历史预算选择；当前轮次与未完成调用/审批链保留，旧 reasoning 和空消息按 SDK 规则清理。Token 使用保守的中英文估算，系统规则、工具定义和输出另计，并非模型上下文上限的精确测量。必要内容超预算时明确报错，不截断当前任务或继续写入。

六个写工具通过 `toModelOutput` 返回精简执行结果，完整业务成果仍供界面显示并保存在原业务库。预算检查在 SDK 执行已批准工具之前运行，并在后续每个模型步骤重查。下面的摘要与对象绑定属于后续目标，当前 `summary` 字段仍未投入流程；超预算移出的旧约束尚不能自动恢复。

目标请求上下文按下列顺序组装：

1. 固定系统规则、当前日期和界面语言；
2. 当前 Agent 可用工具的名称、说明和 Zod 参数结构；
3. 已有线程摘要——只有长对话产生摘要时才加入；
4. 最近若干个完整对话轮次，按 Token 预算保留；
5. 用户本次消息；
6. 本轮按需产生的工具结果。

录阶不发送“当前页面”。这个词容易被误解成页面截图、HTML 或整页数据。未来只允许传递当前选中的业务对象 ID：

```ts
type AgentSubject =
  | { type: "resume"; resumeVersionId: string }
  | { type: "job"; jobId: string }
  | { type: "application"; applicationId: string }
  | { type: "interview"; interviewPreparationId: string }
  | null;
```

从全局右下角宠物打开时不传对象；从具体简历或岗位入口打开时只传 ID。模型不能直接相信 ID 对应的内容，仍需通过工具重新查询当前数据库。

目标上下文处理是一条顺序流水线，不是三个互斥方案：

```text
SQLite 完整历史
  → 程序清理旧 reasoning、已完成的陈旧工具参数/大结果和空消息
  → 按“用户问题 + Assistant 回答 + 相关工具调用/结果”组成完整轮次
  → 从最近轮次向前按约 12K Token 的初始预算保留
  → 只有必须移出仍有价值的旧轮次时，才合并更新结构化线程摘要
  → 系统规则 + 摘要 + 最近原始轮次 + 本次消息
```

第一层和第二层完全由代码执行：复用当前 AI SDK 已安装的 `pruneMessages` 清理可丢弃内容，再按完整轮次和 Token 估算选择消息。当前未完成的工具调用、审批和正在执行的任务必须保留。

第三层只在超过预算时调用当前配置的模型，把最旧的一批完整轮次压缩为 Zod 校验的结构化摘要：

```ts
type AgentThreadSummary = {
  goal: string;
  confirmedFacts: string[];
  decisions: string[];
  completedActions: string[];
  pendingQuestions: string[];
  constraints: string[];
  references: {
    resumeVersionId?: string;
    jobId?: string;
    applicationId?: string;
    interviewPreparationId?: string;
  };
};
```

摘要只描述对话目标、已确认事实、决策、完成动作、待办和引用，不复制简历/JD 正文。业务日期、岗位阶段和记录是否存在始终以数据库为准。压缩失败时保留旧摘要和完整历史，不覆盖；已经压缩过的轮次不重复压缩，只合并新移出的批次。多数只聊几轮的用户不会触发额外摘要调用。

### 4.3 跨线程长期记忆：第一版不自动建立

第一版不自动从对话中提炼“用户偏好”。原因是求职信息涉及隐私，且模型可能把一次性的岗位条件错误记成长期偏好。

未来如果确有需求，只保存用户明确确认的结构化偏好，例如：

- 目标城市；
- 目标岗位方向；
- 默认简历；
- 输出语言和表达风格。

这些偏好应可查看、修改和清除，不引入 Mem0、Letta、Supermemory 或向量数据库。录阶现有 SQLite 和结构化字段足以覆盖首版。

### 4.4 控制中心只作为按需业务工具

控制中心不是默认系统上下文，也不写入 Agent 长期记忆。它是数据库当前状态的派生视图，保存一份快照很快会过期。

后续新增只读 `get_dashboard_context` 时遵守以下规则：

- 用户问“我今天该做什么”“根据整体进度给建议”“有哪些到期跟进”时调用；
- 用户直接要求改简历、做 JD 优化或模拟面试时不调用；
- 复用现有控制中心汇总逻辑，最多返回 3 个优先事项和必要计数；
- 每次调用都重新计算，不把旧结果保存为记忆；
- 如增加“今日行动建议”显式按钮，该按钮可确定性触发工具，普通自然语言仍由 Agent 判断是否需要。

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
    API --> THREADS[(AgentThread + UIMessage JSON)]
```

核心原则：模型负责理解目标、选择工具和生成提案；真正写数据的代码仍由确定性的业务函数完成。

### 5.1 Agent 运行时

使用现有 AI SDK 6：

- `ToolLoopAgent`：统一系统规则、模型和工具；
- `tool` + Zod：声明输入和输出；
- API 请求与服务端线程读取：注入线程 ID、语言和可选 `AgentSubject` 引用；
- `prepareStep`：裁剪上下文并限制当前步骤可用工具；
- `stopWhen: stepCountIs(...)`：避免循环失控和费用不可控；
- `createAgentUIStreamResponse`：向前端流式返回文本和工具状态；
- `InferAgentUIMessage`：保持工具结果与前端渲染类型一致；
- `onStepFinish`：记录工具名称、耗时、结果状态和 token 使用量。

第一版建议最多 6–8 步，不使用默认 20 步上限。录阶任务不是开放式互联网研究，大部分操作应在 2–4 次工具调用内完成。

当前使用 DeepSeek Flash 的真实验证还确认了一个兼容性边界：该模型在 OpenAI-compatible 接口下不接受“强制指定某个具体工具”的 `tool_choice`，会直接令请求失败。当前实现通过 `activeTools` 只开放唯一正确的后续写工具，同时保留普通自动工具选择，既避免选错，也不发送该模型不兼容的参数。未来模型能力探针必须覆盖具体工具选择、客户端工具结果续接和审批续接，不能只测普通 JSON。

### 5.2 工具不是现有 API 的重复包装

Agent 服务端工具直接调用现有 service / repository，不从服务端再请求自己的 HTTP API。API 路由、普通页面和 Agent 工具应复用同一业务函数及 Zod schema。

建议工具分三类：

| 类别 | 示例 | 是否确认 |
| --- | --- | --- |
| 读取 | 查询简历、岗位、投递、面试资料 | 不需要 |
| 生成提案 | 解析投递描述、准备简历修改、生成 JD 匹配计划 | 不需要写数据 |
| 提交变更 | 新增/更新投递、创建简历版本、保存成果 | 必须确认 |

第一版优先采用“提案 → 确认 → 确定性提交”，而不是让模型工具一调用就直接写数据库。它同时适配本地 SQLite 和在线浏览器存储，也便于用户看到将要发生什么。

### 5.3 当前已经实现的运行链路

当前本地版提供九个业务能力，并额外注册两个客户端选择交互：三个读取工具定位招聘记录或稳定业务 ID，六个写工具复用现有业务函数并由 AI SDK 强制审批；两个选择交互只负责把用户在卡片中的偏好送回模型，不属于独立业务能力。之所以不把选择卡直接塞进写工具，是因为当前 AI SDK 的审批响应只能提交同意、拒绝与原因，不能替换模型已经生成的工具输入；硬合并会造成界面选择与服务端实际参数不一致。参数选择不写数据，也不替代后续写入确认：

`prepareStep` 会按当前用户请求动态缩小可用工具：本轮尚未收到选择卡结果时，模型看不到对应的 JD 或面试写工具；收到选择结果后只开放唯一对应的写工具，但不发送 DeepSeek Flash 不兼容的强制指定工具参数。新用户消息会重新要求选择，避免复用上一项任务的旧偏好，也减少 Flash 模型每一步需要区分的工具数量。

| 工具 | 类型 | 当前作用 |
| --- | --- | --- |
| `search_campus` | 读取 | 按条件分页搜索校招库，每页五条摘要；按招聘记录 ID 读取详情，不自动创建个人岗位或投递 |
| `search_pipeline` | 读取 | 搜索后端 `Job`，同时返回该岗位可选的 `Application`；支持精确 ID、关键词、分页，空关键词仅用于用户明确要求“最近记录” |
| `get_resume_context` | 读取 | 按名称、岗位、技能、学校、公司或项目检索全部简历后分页；精确 ID 返回完整脱敏正文 |
| `configure_jd_optimization` | 选择 | 展示四项 JD 优化开关及推荐项，把用户选择返回模型，不写数据 |
| `configure_interview` | 选择 | 展示综合、项目、行为或 HR 模式及推荐项，把用户选择返回模型，不写数据 |
| `update_application_card` | 写入 | 新增或更新一张投递卡片；由 AI SDK 的 `needsApproval` 强制要求用户批准 |
| `create_resume_from_experience` | 写入 | 把用户明确口述的事实整理成一份新的独立简历并保存，不修改已有简历 |
| `create_jd_tailored_resume` | 写入 | 基于精确简历版本和现有岗位或完整 JD 生成新的定制版本，不覆盖来源简历 |
| `create_interview_preparation` | 写入 | 基于精确岗位、简历版本和用户选择的重点生成并保存面试准备资料 |
| `create_mock_interview` | 写入 | 基于精确岗位、简历版本和用户选择的模式生成题目并保存会话，随后进入模拟面试页 |
| `update_resume_presentation` | 写入 | 只切换指定简历版本的模板，保留正文、事实与分区 |

所有读取限制都是“单次返回上限”，不是“只能看前几条”：岗位和简历工具先搜索全部本地记录，再按 `offset + limit` 返回，单次最多 20 条；校招工具按 `page` 返回五条摘要。列表返回 `total` 与 `hasMore`，精确 ID 查询不受列表位置影响。

完整简历读取统一复用 `buildAiResumeSnapshot`：删除邮箱、电话、链接、Logo、编辑器设置及内部优化元数据，与 JD 匹配和面试准备发送简历时使用同一脱敏边界。

每轮请求的真实流程是：

1. API 从 SQLite 读取该线程的完整 `UIMessage` 历史并合并客户端最新消息；
2. 校验消息顺序和当前工具 schema，拒绝客户端新增 assistant 消息或不兼容的旧工具调用；
3. 将完整历史交给 SDK 回放，`prepareCall` 和 `prepareStep` 只裁剪模型输入；按完整轮次和历史预算保留最近消息及未完成交互；
4. 模型看到系统规则，以及当前步骤开放的工具说明和 Zod 输入结构，由其通过结构化 function calling 选择工具；
5. JD 与面试任务先显示选择卡；客户端把用户选项作为工具结果送回模型；
6. 写工具显示最终参数；收到用户批准后先校验历史与预算，再以 `updatedAt` 比较更新持久化这次确认已被接收，保存成功后才调用业务函数；并发旧请求在执行前返回 409；
7. 一轮结束后按最新持有的线程版本保存完整历史和结果，防止覆盖另一请求已保存的记录；保存失败经流式错误返回。单次请求最多运行 8 个步骤。

当前没有 embedding、向量数据库或向量语义检索。上下文由“最近完整轮次 + 按需查询当前结构化业务数据”组成，数据库始终是事实来源。模型运行时也不会阅读本开发文档；它真正获得的是 `career-agent.ts` 中的系统规则、工具描述、输入 schema、消息和工具返回值。

对于 Flash 等轻量模型，这个结构仍保持明确边界：读取、偏好选择和写入名称不同，生成与保存不重复拆分，搜索顺序写进系统规则，写操作还有代码层审批。Agent 只在用户明确要求整条链路时才串联多个工具，简单请求只调用对应工具。但 Provider 和具体型号必须真正支持 OpenAI-compatible function calling；AI SDK 统一接口不代表每个兼容服务都能可靠调用工具。当前能力探针仍未实现。

## 6. 下一阶段工具缺口与合并原则

当前 11 个工具契约已经覆盖主要本地业务流程。后续先检查能否扩展已有工具的输入或结果；只有职责、审批边界或数据来源确实不同才新增工具。

### 6.1 `get_dashboard_context`：按需读取控制中心

输入：可选关注范围，例如今日行动、到期跟进或整体流程。
输出：当前统计、最多 3 个优先事项及其稳定业务 ID。
约束：只读、每次重新计算、普通简历/JD/面试任务不自动调用，不能把快照保存为长期记忆。

### 6.2 现有简历的受控内容编辑

当前 `create_resume_from_experience` 负责创建独立简历，`create_jd_tailored_resume` 负责创建定制版本，`update_resume_presentation` 只改模板；三者边界清楚，不应合成一个巨型工具。仍缺少的是“修改一份已有简历的具体内容”。

后续可新增一个受控 `update_resume_content`，但必须复用编辑器现有 schema 和保存逻辑，并满足：

- 精确指定 `resumeVersionId`，不能按名称猜；
- 只使用用户明确提供或原简历已有的事实；
- 先返回字段级差异和事实风险，用户确认后才保存新版本；
- 默认不覆盖来源版本；
- 改模板继续使用 `update_resume_presentation`，不要让内容编辑工具同时承担视觉职责。

### 6.3 强化已有写工具，而不是拆成重复工具

- `update_application_card`：补充原值 → 新值展示、确认期间数据变化校验和更明确的相对日期回显；
- `create_resume_from_experience`：增加缺失事实追问和可预览草稿，不另建一套 Agent 专用简历 schema；
- `create_jd_tailored_resume`：继续复用现有 JD 优化设置与保存逻辑，保持来源简历不被覆盖；
- `create_interview_preparation`：结果继续进入岗位资料库；
- `create_mock_interview`：只负责生成并保存会话，真正逐题作答和复盘仍由模拟面试工作区承担；
- `update_resume_presentation`：只处理现有模板枚举，不同时修改正文。

不增加单独的 `open_artifact`：每个成果工具直接返回最合适的录阶路由，由结果卡片提供“点击打开结果”。也不为“展示 JD 设置卡”“展示面试模式卡”再创建更多业务工具；当前两个 `configure_*` 是客户端参数交互契约，不是独立业务能力。

## 7. 对话持久化

### 7.1 公开本地版

当前公开本地版采用一张最小表，不修改已发布 migration：

```prisma
model AgentThread {
  id        String   @id @default(cuid())
  title     String   @default("新对话")
  messages  String   @default("[]")
  summary   String   @default("")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([updatedAt])
}
```

`messages` 保存完整 `UIMessage[]` JSON，而不是只保存发给模型的 `ModelMessage`。从数据库恢复后先做基础结构校验，发给 Agent 前再通过 `validateUIMessages` 按当前工具 schema 校验；旧消息结构不兼容时拒绝继续执行，不能让模型执行其中的旧工具调用。

单表 JSON 是首版本地应用的有意简化：线程整体读写、消息量有限，不需要为分页或跨消息查询先引入第二张表。只有真实对话规模导致整段读写成为瓶颈时，再拆分 `AgentMessage`，不能只为“看起来像聊天系统”提前复杂化。

保存使用 `updatedAt` 条件更新，并保证新时间至少前进一毫秒。批准工具执行前，先在同一历史中用 SDK 的 `output-error` 状态持久化“确认已接收，结果尚未确认”，从而使同一次确认最多被一个请求接收；只有成功保存的请求才执行。正常完成后用真实结果替换该状态；中断时仍未收到结果的已批准调用也保留这一提示，旧确认不能恢复成可执行状态。读取、参数选择和拒绝操作无需额外预存。

此机制只防止同一确认的重放，不保证业务与历史原子提交，也不提供自动恢复。保存失败、断流或进程退出后可能已经有业务成果，也可能还没开始；需重新打开对话并核对业务库后再决定是否发起新操作。停止聊天不会撤销已开始的业务函数。不同线程或重新发起的不同工具调用仍需由业务层处理身份与重复创建问题。

当前尚未持久化页面与业务对象绑定。后续加入时只保存对象 ID，不建立外键：删除业务资料后仍应保留对话历史；每次使用 ID 时重新查询，找不到就标记为失效引用。

### 7.2 在线版

在线版按当前存储约定使用浏览器 IndexedDB，不得把对话写入服务器 SQLite；旧 localStorage 仅用于兼容迁移。保留现有数据库、记录 key 和迁移约定，不为上下文升级另建一套存储。本轮没有修改或验证在线版的上下文与并发行为。

保存相同的线程和消息 DTO，只在一轮生成完成后写入，不在每个 token 到达时重写。在线版后续需在 IndexedDB 事务内完成版本比较与保存，并验证多标签页冲突；不能直接照搬本地 Prisma 实现。

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
  career-agent.ts              # ToolLoopAgent、系统规则与工具注册
  application-tools.ts         # 投递工具 schema 与确定性执行
  workflow-tools.ts            # 简历、JD、面试与模板的业务工具
  message-context.ts           # 消息合并、完整轮次与预算；摘要尚待接入
  pet-position.ts              # 宠物位置边界与持久化数据规范化
  thread-store.ts              # SQLite 线程与 UIMessage 持久化

src/app/api/agent/
  chat/route.ts
  threads/route.ts
  threads/[id]/route.ts
```

在线版复用消息 DTO、Agent UI、工具 schema 和提案提交逻辑，只替换线程存储和业务提交入口。不要为每个工具新增一条独立 API 路由。

## 10. 当前实现与后续触发条件

### 已完成：本地版可执行工具闭环

- 团子入口、覆盖式/全屏面板、拖动、历史线程、语音输入和 Markdown 渲染；
- `ToolLoopAgent`、流式状态、客户端参数选择和服务端写入审批；
- 岗位/投递与简历检索；
- 投递卡片、独立简历、JD 定制、面试准备、模拟面试和模板切换；
- 结果按类型跳转到编辑器、岗位资料库或模拟面试工作区；
- 修复 DeepSeek Flash 强制工具选择不兼容、旧配置卡误操作和结果链接按钮语义问题。

对应本地提交：`d08a8d2 feat: expand in-app career agent workflows`。

### 已实现：完整轮次预算与保存保护（公开本地版）

1. 移除 12 条消息限制，按完整轮次和约 12K Token 保守估算选择模型历史；
2. 清理旧 reasoning 和空消息，六个写工具给模型返回精简结果；原始 UI 历史与业务成果保留；
3. 在已批准工具执行前检查，并在工具循环每步重查；必要内容超预算时明确报错；
4. 保留当前轮次及未完成工具、审批链，避免单独移除调用或结果；
5. 保存时比较线程版本，冲突不覆盖，并向客户端返回可读错误。

这里是历史裁剪与结果精简，不是语义摘要。被移出模型上下文的早期约束不会自动保留，必要时应询问用户或重新读取业务数据。约 12K Token 仅为历史预算的保守估算，不包含系统规则、工具定义和模型输出；实际模型窗口与 Token 消耗仍需真实 Provider 验证。

### 本次复核：精简重复处理，保护续接边界

- 复用 SDK 的消息和工具 schema 校验，删除路由中的重复全历史校验；
- 使用原生 `findLastIndex`，预算从后向前累计，保存后不再无用回读；
- 校招精确详情不再重复返回全库筛选字典，搜索仍保留可选筛选值；
- 客户端只能提交原待审批工具的决定，或两个待选择工具的结果；不能改写工具参数、历史文本、已完成结果或重新打开已完成调用；
- 保留执行已批准工具前及每步调用前的预算检查、保存冲突检查与流式错误回传，它们承担不同的数据保护职责。

2026-10-03 继续修复：复现了两次并发确认执行两次业务写入的问题，已在执行前复用现有线程 CAS 接收确认；中断或最终保存失败时保留结果不确定的提示并禁止重放。没有新增表、队列、依赖或自动重试。路由拆开 SDK 的校验、转换和执行入口，只为在它们之间插入持久化检查，不重复校验整段历史。默认 Vitest 排除本机临时审计及生成资源目录，避免重复扫描残缺测试副本。

### 2026-10-03 后端验收

- 70 个测试文件、330 项测试通过，类型检查和定向 ESLint 通过。一次默认并发复跑遇到本机内存不足，使用 `node node_modules/vitest/vitest.mjs run --maxWorkers=2` 后全部通过。
- 生产构建通过。本机默认并发构建也遇到内存不足；仅在验收进程设置 `NODE_OPTIONS=--max-old-space-size=1024`、`CIRCLE_NODE_TOTAL=3`，使用两个静态构建 worker 完成，未修改项目构建配置。
- 独立合成 SQLite 中，同一次审批的并发竞争仅一个请求成功，业务检查写入一次；重新读取历史后旧确认仍不能重放。
- 使用本机已配置的 DeepSeek Flash，在独立测试数据库中跑通校招搜索与详情、独立简历创建、JD 定制、面试准备和投递跟进。参数选择与写入审批由测试脚本提交；数据库核对为 1 份独立简历、1 个岗位、1 份面试资料、1 张正确关联的投递卡。校招查询和 JD 定制均未自动创建投递。
- 实测发现参数卡返回后模型可能误报写工具不可用。删除写工具说明中重复要求先调用配置工具的措辞，改为使用已完成配置卡的结果；失败样例及上述整条链路复验通过。保留 `auto` 和 `activeTools`，未引入服务返回 400 的强制工具选择，也不据此保证模型永不误选。
- 真实模型验证覆盖上述五段后端流程，不代表全部模型、全部工具或 UI 已验收。未修改个人业务数据，未重新打包桌面安装器，未同步在线版；历史预算仍不等于语义摘要。

### 接下来优先验证的真实问题

- 其他 Provider、模型版本及实际界面的工具调用、参数选择和审批续接；本次单一模型后端验收不能替代这些验证；
- 不同线程或用户重新发起的操作是否重复创建业务对象；若需要自动重试或恢复，仍需处理业务结果与执行记录的原子提交，不能把本次确认防重放当作完整幂等系统；
- 岗位身份、同名消歧、简历目标选择与已有业务保存逻辑。由共享 service/repository 修复，不为每个工具另建存储。

### 有明确需求时再实现

- **对象绑定**：用户频繁从简历或岗位页面说“修改这个”时，增加可选对象引用，读取数据库当前状态；
- **线程摘要**：真实长对话持续丢失早期约束时，利用已有 `AgentThread.summary` 做增量摘要，覆盖被裁剪的完整轮次，并验证事实与费用；
- **可控简历编辑**：扩展到修改既有正文时，先展示字段差异并确认，再保存新版本；
- **控制中心工具**：确有整体进度问答需求时，复用现有汇总，不默认注入快照；
- **在线版同步**：作为独立变更适配浏览器存储、验证并授权发布，不能把公开本地版检查视作线上已完成。

跨线程长期记忆、向量库、多 Agent、第二套运行时与跨天任务恢复均不属于当前必做范围。

## 11. 测试与完成标准

以下是对应能力实现或发布时的验收清单；尚未实现的候选能力不代表当前已通过，也不要求为了满足清单先新增功能：

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
12. 公开版 SQLite 与在线版浏览器存储分别完成真实行为验证；
13. 上下文永远从用户消息开始，不截断为孤立的 Assistant 回答；
14. 旧工具大结果被清理，但最近未完成调用和审批完整保留；
15. 超过预算时只压缩旧完整轮次，摘要失败不破坏旧摘要和原始历史；
16. 简历/JD/岗位阶段在摘要与数据库冲突时以数据库当前值为准；
17. 用户直接改简历时不读取控制中心，询问整体进度时才调用控制中心工具；
18. DeepSeek Flash 等兼容模型不会收到已知不支持的强制指定工具参数。

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
