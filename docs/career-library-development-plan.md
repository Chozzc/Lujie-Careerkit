# 求职资料库开发计划与存储说明

> 状态：待实施  
> 日期：2026-08-13  
> 前置规范：[求职资料库设计规范](./career-library-design-spec.md)

## 1. 先回答：资料现在到底存在哪里

### 1.1 公开本地版

公开本地版使用 Prisma + SQLite。当前配置是：

```text
DATABASE_URL="file:./dev.db"
实际文件：prisma/dev.db
```

`.db` 是一个 SQLite 数据库文件，不是 JSON 文件夹。复杂资料由 Prisma 声明为 `Json` 字段，写入 SQLite 后以可校验的 JSON 值保存在对应表的列中；当前数据库实际查询到的底层存储类型为 `text`。因此更准确的说法是：

> 数据保存在 SQLite 的表和记录中，其中部分列的内容采用 JSON 结构；磁盘上只有数据库文件，不会为每份资料另建一个 `.json` 文件。

当前映射如下：

| 资料 | SQLite 表 | 普通列 | JSON 结构列 |
| --- | --- | --- | --- |
| 主简历 | `Resume` | 名称、时间 | `content` |
| 通用优化简历 | `ResumeVersion` | 名称、摘要、时间，`jobId = null` | `content`，内部可含原简历、诊断、优化元数据和审阅状态 |
| JD 定制简历 | `ResumeVersion` | 名称、摘要、时间、`jobId` | `content`，内部可含原简历和优化元数据 |
| JD 与岗位分析 | `Job` | 公司、岗位、JD、链接、时间 | `tags`、`analysis` |
| 面试准备资料 | `InterviewPreparation` | `jobId`、简历关联、模式、时间 | `context`、`content` |
| 模拟面试与复盘 | `InterviewSession` | 状态、当前题号、岗位和简历关联、时间 | `context`、`questions`、`answers`、`feedback` |
| 投递状态 | `Application` | 状态、日期、备注及关联 | 无主要成果 JSON |
| 跟进日志 | `FollowUpLog` | 类型、正文、时间及关联 | 无 |

“保存在同一记录中”的具体含义，例如一次模拟面试：数据库中有一条 `InterviewSession` 记录；问题、回答和复盘不是三个文件，而是这条记录的 `questions`、`answers`、`feedback` 三个 JSON 列。面试准备则是另一条 `InterviewPreparation` 记录，它的完整准备资料位于 `content` JSON 列。

通用简历优化也不是单独的 Markdown 或 PDF 文件。它是一条 `ResumeVersion`：优化后的完整简历在 `content` 中；用于还原过程的原简历、诊断、用户选择、优化草稿和采纳状态，可能位于同一个 `content` 对象的内部字段中。

### 1.2 在线版

当前在线版没有把业务资料写入服务器 SQLite。它调用：

```text
localStorage key：lujie-careerkit:online-demo:data:v2
保存形式：JSON.stringify(整个 InitialData)
```

该 key 包含简历、简历版本、岗位、投递、模拟面试和面试准备等业务数据。AI 设置另存于：

```text
lujie-careerkit:online-demo:ai-settings:v2
```

这些数据位于用户当前浏览器、当前 origin 的站点存储中，不在项目方的服务器数据库中。网站脚本在同一 origin 下可以读写它；清理站点数据、更换域名/协议/端口、换浏览器或换设备都不会自动同步。

IndexedDB 如果未来启用，也仍然是用户浏览器里的本地站点存储，不会因为从 localStorage 改成 IndexedDB 就自动上传到项目方服务器。它与 localStorage 的主要区别是容量、事务和结构化读写能力，不是“本地/云端”的区别。是否向 AI 服务发送所选简历和 JD 属于生成时的数据处理链路，与持久化位置是两个问题，产品隐私说明需要分别披露。

### 1.3 容量核对

2026-08-13 对当前本地开发数据库做了只读统计：

- `prisma/dev.db` 文件大小：约 **90.46 MiB**；
- SQLite 当前已占用页面：约 **7.12 MiB**；
- 已释放但尚未归还给文件系统的空闲页面：约 **83.34 MiB**；
- 当前简历、岗位分析、面试准备、模拟面试等主要 JSON/文本字段合计：约 **38 KiB**。

因此当前 `.db` 的 90 MiB 主要不是现有文字资料造成的，而是 SQLite 删除旧数据后保留了大量可复用空闲页。后续新增数据会先复用这些页。首版资料库只读取和组织现有记录，几乎不增加持久化容量。

一般情况下，结构化文字资料每份通常是 KB 级；更需要关注的是简历内容中允许存在的 base64 图片/Logo，它比纯文字大得多，并且 base64 本身还会增加体积。PDF/DOCX 导出不应回存数据库。数据库压缩（例如 SQLite `VACUUM`）不是资料库首版需求，不自动执行，避免无备份情况下进行大规模文件重写。

在线版当前使用 localStorage，配额由浏览器决定且不可依赖固定数值。资料库本身不复制数据，因此不会加剧容量问题。后续如果实际数据量触及配额，应单独实施 localStorage 到 IndexedDB 的兼容迁移，并同时提供导出备份、配额失败提示和恢复方案；首版不为资料库顺带迁移存储。

## 2. 架构决定

### 2.1 不新增“资料库记录”表

首版资料库是现有成果的统一索引和查看层，不建立 `LibraryItem` 数据表，也不把成果复制为新的 JSON。

这样可以保证：

- 同一份 JD 定制简历仍只存在于 `ResumeVersion`；
- 从简历编辑器和资料库打开的是同一个版本；
- 删除、重命名和更新时间不会出现两套状态；
- 公开版无需数据库迁移；
- 在线版无需修改 localStorage key 或复制整个数据集。

只在代码中建立一个轻量只读视图模型，把现有记录映射为卡片和树节点。

### 2.2 建议视图模型

在 `src/lib/career-library.ts` 中定义最小必要类型与纯函数：

```ts
type CareerArtifactKind =
  | "general-resume-optimization"
  | "job-resume-optimization"
  | "job-analysis"
  | "interview-preparation"
  | "mock-interview";

type CareerArtifactRef = {
  id: string;
  kind: CareerArtifactKind;
  title: string;
  jobId: string | null;
  updatedAt: string;
};
```

纯函数负责：

- 从 `InitialData` 建立成果列表；
- 按 `jobId` 聚合岗位档案；
- 按类型分组；
- 计算岗位档案的数量和最近更新时间；
- 搜索、排序；
- 根据实际字段生成详情树，缺少历史字段时安全降级。

不建立通用仓储抽象，不新增依赖，不在映射层写数据。

## 3. 路由与应用外壳

### 3.1 导航

修改：

- `src/lib/navigation.ts`：`NavKey` 增加 `library`，路径为 `/library`；`/library/...` 解析为 `library`。
- `src/components/app/navigation.tsx`：新增文件夹图标的“求职资料库”，顺序紧跟 `pipeline`。
- `messages/zh-CN.json` 与 `messages/en.json`：同步导航、页面、状态和空状态文案。

最终顺序：

```text
控制中心
简历编辑器
JD匹配优化
面试助手
投递岗位跟进
求职资料库
设置
```

### 3.2 页面地址

建议使用可直接访问和可返回的地址：

```text
/library                              默认按岗位
/library?group=type                   按分类
/library/jobs/{jobId}                 岗位档案工作区
/library/artifacts/{kind}/{id}        成果工作区
```

使用一个 `src/app/library/[[...detail]]/page.tsx` 入口加载 `getAppData()` 并把初始目标传给 `CareerKitApp`，避免为每类成果建立重复页面文件。

### 3.3 隐藏全局外壳

参照现有 `isResumeEditor`，增加明确的 `isLibraryWorkspace` 状态：

- 列表页：显示 `AppSidebar` 和 `AppTopbar`；
- 岗位/成果工作区：隐藏二者，主内容取消 `lg:ml-72` 和页面容器宽度；
- 浏览器前进/后退必须同步列表、岗位工作区和成果工作区状态。

不要把资料树作为普通列表页内部组件嵌套。

## 4. UI 实施拆分

遵循最少文件原则，建议先落三个模块：

1. `src/components/library/career-library-view.tsx`
   - 按岗位/按分类切换；
   - 搜索、排序、网格/列表；
   - 分类分段；
   - 内部复用同一个卡片组件。
2. `src/components/library/career-library-card.tsx`
   - 岗位和成果共享视觉骨架与统一档案图形；
   - 通过数据决定文字，不通过类型改变结构或插画。
3. `src/components/library/career-library-workspace.tsx`
   - 顶部工作区工具栏；
   - 左侧资料树；
   - 右侧按当前成果类型调用现有内容展示能力。

如果两个组件可以在一个文件中保持清晰，就不额外拆文件。

优先复用：

- 现有按钮、Badge、Tooltip、滚动区和图标；
- 简历优化已有的 before/after、诊断和修改摘要数据；
- 面试准备现有的结构化内容展示；
- 模拟面试已有的问题、回答和复盘展示；
- 简历编辑器的全屏外壳尺寸和隐藏规则。

不复制已有成果渲染逻辑来做一套“资料库专用版本”；需要时提取最小的共享展示组件。

## 5. 数据与操作边界

### 5.1 数据识别

- 通用优化简历：`ResumeVersion.jobId` 为空，且 `content._tailoringBaseResume` 存在。
- JD 定制简历：`ResumeVersion.jobId` 非空。
- 普通简历副本：不满足以上条件，不进入资料库。
- 岗位分析：`Job.analysis` 有有效内容时进入。
- 面试准备：每条 `InterviewPreparation` 都是一项成果。
- 模拟面试：每条 `InterviewSession` 都是一项成果；只有存在有效 `feedback` 时显示复盘节点。

### 5.2 删除与修改

- 岗位档案是派生分组，首版不能整档删除。
- 成果删除复用现有 API 和仓储函数，不增加“资料库删除副本”。
- `Job.analysis` 当前与岗位记录同表，首版只读，不提供单独删除岗位分析，避免误删整个岗位及关联投递。
- 从资料库打开优化简历编辑器时编辑原 `ResumeVersion`。
- 删除成果后，列表和岗位计数从当前 `InitialData` 重新派生。

### 5.3 历史兼容

旧数据可能缺少 `_optimizationStages`、结构化诊断或新版面试复盘。处理原则：

- 有字段才显示节点；
- 无字段时仍可展示优化后简历、摘要、问题与回答等现有内容；
- 不把“字段不存在”解释成“用户没有能力”；
- 不为旧记录写回伪造的默认内容；
- 无需修改现有存储 key 或数据库历史 migration。

## 6. 原入口迁移

资料库完成并验证后，删除 `AppPageHeader` 中用于完整浏览以下历史成果的右上角下拉列表：

- 优化简历版本列表；
- 已生成面试准备资料列表；
- 模拟面试与复盘记录列表。

保留当前流程中的直接操作：

- 生成完成后查看本次结果；
- 进入简历编辑器；
- 前往求职资料库。

迁移完成后不保留两套历史管理入口或兼容菜单。

## 7. 实施顺序

### 阶段一：只读资料索引

1. 增加 `library` 导航和中英文文案。
2. 实现成果识别、按岗位聚合、按分类分组、搜索和排序纯函数。
3. 建立 `/library` 列表页，完成统一卡片。
4. 此阶段不改变数据库、localStorage 和任何生成 API。

### 阶段二：独立工作区

1. 增加岗位档案深链接和资料树。
2. 增加成果深链接和动态资料树。
3. 复用现有结果组件显示正文。
4. 完成关闭、返回、浏览器前进/后退和已删除记录状态。

### 阶段三：管理动作与入口收敛

1. 接入已有成果删除和打开简历操作。
2. 增加必要的删除确认和错误反馈。
3. 从原页面右上角移除完整历史下拉列表。
4. 在生成完成页增加“前往求职资料库”。

### 阶段四：在线版同步

1. 移植共享 UI、类型和纯映射逻辑到私有在线版。
2. 复用在线版现有 `InitialData` 和 localStorage 保存流程。
3. 不更改 `lujie-careerkit:online-demo:data:v2`，不引入服务器持久化。
4. 验证刷新、清理站点数据、配额写入失败和中英文文案。

## 8. 最小测试计划

新增一个针对派生逻辑的小型 Vitest 测试文件，至少覆盖：

1. 通用优化与普通简历副本不会混淆；
2. JD 定制简历同时出现在对应岗位和“简历成果 / 岗位定制”；
3. 同一成果只生成一个 `id + kind` 引用，不复制数据；
4. 岗位计数和最近更新时间正确；
5. 历史通用优化缺少诊断时不生成诊断节点；
6. 未完成模拟面试不生成 AI 复盘节点；
7. 搜索和最近更新排序正确；
8. 没有成果的岗位不生成岗位档案。

实现完成后执行：

```text
npm test
npm run lint
npx tsc --noEmit
npm run build
```

并做最小真实交互检查：

- 导航进入资料库；
- 按岗位/按分类切换；
- 点击岗位与成果进入全屏工作区；
- 工作区中不出现双层侧栏；
- 浏览器返回恢复原列表和筛选；
- 删除一项可删除成果后两种视图同步更新。

## 9. 首版明确不做

- 不新增数据库表或 migration；
- 不迁移 localStorage 到 IndexedDB；
- 不实现正文全文搜索；
- 不保存第二份成果快照；
- 不把求职信/招呼语假装成已保存资料；
- 不支持整档删除岗位；
- 不顺带重构全部导航或结果页；
- 不自动压缩或重写用户的 SQLite 数据库。

后续只有在“求职信等独立文档正式支持保存”时，再评估是否需要一个通用生成文档模型；在此之前，现有表已经覆盖首版资料库。

