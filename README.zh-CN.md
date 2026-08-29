<p align="center">
  <img src="public/brand/lujie-mark.svg" alt="录阶标识" width="72" />
</p>

<h1 align="center">录阶 / LuJie CareerKit</h1>

<p align="center">
  <strong>从简历编辑到 Offer 录用的 求职 Agent 工作台，覆盖简历编辑、JD 匹配、投递跟进、模拟面试和复盘等。</strong>
</p>
<p align="center">
  <a href="README.md">English</a> · 简体中文
</p>


<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs" />
  <img alt="React" src="https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white" />
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-6-2d3748?logo=prisma" />
  <img alt="SQLite" src="https://img.shields.io/badge/SQLite-local--data-044a64?logo=sqlite" />
  <img alt="Docker Image" src="https://github.com/Chozzc/Lujie-Careerkit/actions/workflows/docker-image.yml/badge.svg" />
  <img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-blue" />
</p>

<p align="center">
  <img src="public/brand/lujie-cover_16x9.png" alt="录阶品牌封面" width="900" />
</p>

## 项目简介

录阶面向实习、校招和职业求职场景，把简历编辑、岗位匹配、求职资料管理、面试准备、模拟练习和投递跟进放在一个由Agent驱动的工作台里。你可以围绕不同岗位维护多份简历版本，根据岗位描述生成更贴合要求的简历与面试资料，并把每一次分析、练习和投递进展持续沉淀下来。

## 在线预览

访问 [https://lujie.chozzc.dev](https://lujie.chozzc.dev) 体验在线预览。

## 界面预览

| **控制中心**                                                 | **简历库**                                             |
| ------------------------------------------------------------ | ------------------------------------------------------ |
| ![控制中心](public/images/01-dashboard.png?v=0.3.0)          | ![简历库](public/images/02-resume-library.png?v=0.3.0) |
| **简历编辑器**                                               | **JD 匹配优化**                                        |
| ![简历编辑器](public/images/03-resume-editor.png)            | ![JD 匹配优化](public/images/04-jd-match.png?v=0.3.0)  |
| **JD 匹配优化简历**                                          | **面试助手**                                           |
| ![JD 匹配优化简历](public/images/05-jd-optimized-resume.png) | ![面试助手](public/images/06-interview-assistant.png)  |
| **模拟面试**                                                 | **AI 复盘**                                            |
| ![模拟面试](public/images/07-mock-interview.png)             | ![AI 复盘](public/images/08-ai-review.png)             |
| **投递岗位跟进**                                             | **投递状态**                                           |
| ![投递岗位跟进](public/images/09-application-pipeline.png)   | ![投递状态](public/images/10-pipeline-status.png)      |

## 功能亮点

- **结构化简历编辑**：维护多份简历版本，可从任意简历创建独立副本进行尝试性调整；编辑教育、实习、项目、技能等模块，切换模板和主题，并导出 PDF、PNG 或可编辑 DOCX。
- **AI 分析简历**：先诊断当前简历的行动与结果、事实证据、表达和结构，再由用户选择要处理的问题与优化方向；确认后生成独立优化版本，并保留原简历。
- **求职信与招呼语**：结合当前简历、完整 JD 和用户补充的到岗安排，生成适合正式投递的求职信或重点前置的招聘平台招呼语，并支持编辑、复制与重新生成。
- **JD 匹配优化**：粘贴包含公司、完整岗位名称、要求和职责的目标 JD，让 AI 在不编造经历的前提下诊断匹配点、重排重点、优化表达并保存岗位定制版本。
- **专属面试准备资料**：结合所选简历与完整 JD，生成资料概览、能力画像、证据与差距、核心知识、经历深挖、针对性问题和准备计划，按简历长期保存，并可导出为可编辑 Word 文档或适合打印的 PDF。
- **投递进展管理**：记录公司、岗位、渠道、阶段、截止日期、跟进日期、备注、JD 和绑定简历版本。
- **模拟面试与复盘**：根据简历和 JD 生成面试题，保存逐题回答，并生成可回看、可继续改进的 AI 复盘报告。
- **求职资料库**：按岗位或资料类型整理原始 JD、岗位定制简历、面试准备、模拟问答和 AI 复盘；进入岗位档案即可连续查看、编辑或删除具体成果。
- **实验性应用内 Agent**：检索岗位与脱敏简历，并在用户选择参数、确认写入后创建独立简历、生成 JD 定制简历、面试准备与模拟面试，切换简历模板或维护投递跟进卡片。
- **求职 Agent Skills**：将录阶中已经打磨的简历优化、面试准备、模拟面试和求职沟通流程整理为四个 Skill，让 Codex、Claude Code 等编码智能体也能复用。
- **数据与隐私可控**：简历、岗位、投递、资料库成果、Agent 对话和设置保存在本机 SQLite 数据库里，适合个人长期维护。

## 实验性应用内 Agent

v0.3.0 新增了一个可在工作台内打开的求职 Agent。它使用应用设置页中已经配置并测试通过的模型，不需要单独再配置一套 API Key；对话会作为本地 `AgentThread` 记录保存在 SQLite 中。

当前实验版本可以：

- 根据自然语言检索已有岗位和投递卡片；
- 按名称、岗位、技能、学校、公司或项目检索简历，并按 ID 读取经过隐私过滤的完整内容；
- 草拟新增或更新投递卡片的操作，并在用户明确确认后执行；
- 根据用户口述的真实经历创建新的独立简历；
- 根据完整 JD 创建新的岗位定制简历版本；
- 根据指定岗位和简历生成面试准备资料；
- 让用户选择面试模式后生成模拟面试，并直接进入答题界面；
- 在保留简历事实与分区的前提下切换现有模板；
- 结合当前上下文提供简历、JD、面试和求职规划建议。

当前版本不会覆盖已有简历正文，也不能删除业务数据或操作外部招聘网站；任何业务写入都必须由用户确认。应用内 Agent 仍是实验功能，上下文管理和操作确认流程会继续迭代。

## Agent Skills

录阶不只提供应用界面，也把其中适合交给编码智能体执行的求职流程整理成了四个 Agent Skill。每个 Skill 都包含完整的执行步骤、调研要求、事实边界和质量检查。

| Skill                    | 用途                                             |
| ------------------------ | ------------------------------------------------ |
| `resume-improvement`     | 诊断并优化简历，也可结合 JD 做岗位定制           |
| `prepare-job-interview`  | 主动调研公司与岗位，生成结构化面试准备资料       |
| `mock-interview-coach`   | 开展逐题模拟面试、动态追问和循证复盘             |
| `job-application-writer` | 撰写求职信、招聘平台招呼语、邮件、内推和跟进消息 |

克隆仓库后，从项目目录启动 Codex，直接描述任务即可；Codex 会根据任务自动选择对应 Skill，也可以用 `$resume-improvement` 等名称明确指定。Claude Code 等其他编码智能体也可以直接读取相应的 `SKILL.md` 来执行同一套流程。

例如：

- `使用 $resume-improvement 分析这份简历，并针对后端开发岗位提出修改建议。`
- `使用 $prepare-job-interview，结合我的简历和这份 JD 生成面试准备资料。`

涉及具体公司或岗位时，Skill 会在搜索工具可用且用户未禁止联网的情况下主动调研，并要求标注来源、区分事实与推断，禁止编造候选人的经历、技能或成果。

## 数据与隐私

- 简历、版本、岗位、投递、面试准备资料、模拟记录、Agent 对话和设置保存在 `prisma/dev.db`。
- API Key 在应用内设置页配置，保存到 SQLite 前会先加密。
- `LUJIE_SETTINGS_SECRET` 是本地加密密钥，用来保护已保存的 AI Key。请在 `.env.local` 里使用足够长的随机字符串。

## 快速开始

### 环境要求

- Node.js 20.9 或更高版本
- npm
- Chrome 或 Edge：浏览器语音识别体验更完整

### Docker 部署（推荐）

```bash
docker run -d --name lujie-careerkit \
  -p 3000:3000 \
  -v lujie-data:/data \
  -e LUJIE_SETTINGS_SECRET="replace-with-a-long-random-string" \
  ghcr.io/chozzc/lujie-careerkit:latest
```

打开 [http://localhost:3000](http://localhost:3000)。SQLite 数据会保存在 Docker volume `lujie-data` 中，API Key 在应用内设置页配置。

`LUJIE_SETTINGS_SECRET` 用于加密本机保存的设置密钥，请替换成一串足够长的随机字符串。

使用 `latest` 会跟随最新的 `main` 构建；v0.3.0 正式发布后，也可以把镜像标签固定为 `v0.3.0`。

### 本地开发

```bash
git clone https://github.com/Chozzc/Lujie-Careerkit.git
cd Lujie-Careerkit
npm ci
```

创建本地环境文件，并生成一个加密密钥：

```bash
cp .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

把生成的值写入 `.env.local` 的 `LUJIE_SETTINGS_SECRET`，然后启动应用：

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。应用会在首次使用时创建本地数据库结构和示例数据。

## 环境变量

```env
DATABASE_URL="file:./dev.db"
LUJIE_SETTINGS_SECRET="change-me-to-a-long-random-string"
OPENAI_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
OPENAI_MODEL="qwen3.6-flash"
```

`OPENAI_BASE_URL` 和 `OPENAI_MODEL` 只用于首次默认值。真实 API Key 请在应用内设置页配置。

## AI 服务配置

1. 打开应用内设置页。
2. 选择 OpenAI-compatible 服务商。
3. 填写 Base URL、模型名称和 API Key。
4. 保存后点击测试连接。

AI 功能会在设置保存且连接测试成功后启用。

## 版本更新

### v0.3.0（实验功能持续开发中）

#### 求职资料库与岗位档案

- 新增“按岗位 / 按分类”两种浏览方式，支持公司分组、搜索、排序和示例岗位标识，集中整理原始 JD、岗位定制简历、面试准备、模拟问答与 AI 复盘。
- 每个岗位都有独立档案页，以目录结构组织资料，并提供岗位概览、准备路径、成果列表和资料构成统计。
- 原始 JD、面试准备和模拟回答可以修改并保存；岗位名称和成果标题可以手动修正，长标题会在目录中安全省略显示。

#### 实验性应用内求职 Agent

- 新增可拖动打开的应用内求职 Agent，复用设置页已经配置并测试成功的 OpenAI-compatible 模型，并将多轮对话保存在本机。
- Agent 可以根据自然语言检索已有岗位和投递记录，并读取过滤邮箱、电话等联系信息后的简历概览。
- Agent 可以草拟新增或更新投递卡片的操作；真正写入前必须由用户明确确认，避免自然语言误解直接改动业务数据。
- 当前仍是实验功能：尚不能直接修改简历、执行完整 JD 优化、生成面试资料、删除资料库内容或自动完成整个求职流程。

#### 首次引导与示例数据更新

- 增加首次使用引导：控制中心 → 连接 AI → 认识实验 Agent → 简历编辑 → JD 匹配 → 面试助手 → 求职资料库 → 投递岗位跟进。
- 内置六个结构化示例岗位，并提供一条完整的百度示例链路：基础简历、岗位定制简历、专业面试准备、八道完整模拟回答、逐题评价与 AI 复盘。
- 设置页新增“一键清空示例数据”，只删除内置示例岗位、示例简历及其生成资料，保留用户自己创建的数据和 AI 设置；“重置并恢复示例数据”仍用于完整重置本地业务数据。

### v0.2.5

#### 将求职流程沉淀为 Agent Skills

- 将录阶中已经打磨的简历优化、面试准备、模拟面试和求职申请写作流程整理为四个 Agent Skill。
- Skill 位于 `.agents/skills`，Codex 可在仓库内直接发现，Claude Code 等其他编码智能体也可读取并复用相同流程。

### v0.2.4

#### 面试准备资料导出

- 已生成的面试准备资料新增“导出资料”入口，可导出为 Word 和 PDF 格式。

#### 逐条审阅并选择保留 AI 简历修改

- AI 简历优化新增逐条审阅流程，修改按简历模块分组，并同时展示简历原文与可直接编辑的 AI 建议。
- 每项修改都可以单独选择采纳、不采纳或继续编辑；右侧预览会跟随当前选择，最终只把采纳的内容保存为新的通用优化版本，原简历保持不变。
- 简历库会区分通用优化版本与 JD 匹配优化版本；GPA、日期、缺失事实等不应由 AI 推测的信息会提示用户返回编辑器核实或补充。

## 常见问题

### 1. 必须配置 API Key 才能使用吗？

不是。简历编辑、资料库浏览、投递跟进等基础功能可以本地使用；应用内 Agent、JD 匹配、面试准备资料、模拟面试和 AI 复盘等 AI 功能需要配置 OpenAI-compatible 服务的 API Key。

### 2. 我的数据保存在哪里？

默认保存在本机的 `prisma/dev.db`。这是本地运行数据，不应该提交到 GitHub。

### 3. 控制中心的数据怎么计算？

- **投递岗位**：统计已进入投递跟进看板的岗位，不包含还未投递的 JD 匹配草稿。
- **活跃流程**：统计仍在推进中的岗位，包括已投递、笔试 / 测评、面试中。
- **到期跟进**：只统计活跃流程。优先使用手动设置的下次跟进日期；已投递且未设置下次跟进时，按投递后 7 天作为建议跟进日；笔试 / 测评和面试中使用当前阶段日期。
- **Offer**：统计已标记为 Offer 的岗位。

### 4. `LUJIE_SETTINGS_SECRET` 是什么？

它是本地加密密钥，用来加密保存到 SQLite 的 API Key。换掉这个值后，旧数据库里已经保存的 API Key 可能无法解密，需要重新在设置页保存。

### 5. 可以换成别的模型服务吗？

可以。只要服务兼容 OpenAI 接口，就可以在设置页填写对应的 Base URL、模型名称和 API Key。

## 项目结构

```text
.github/workflows/      GitHub Actions workflow，包括 GHCR 镜像发布
Dockerfile              生产容器镜像定义
docker-compose.yml      本地 Docker 启动与 SQLite 持久化卷配置
prisma/                 Prisma schema 与本地 SQLite 运行数据
src/app/                Next.js 页面与 API 路由
src/components/         工作台、简历、面试和共享 UI
src/hooks/              浏览器 Hook，例如语音识别
src/lib/                Repository、AI、导出、解析和领域逻辑
src/stores/             简历编辑器状态
src/types/              共享 TypeScript 类型声明
public/brand/           品牌标识和封面资产
public/images/          README 截图
third-party/            第三方许可证说明
```

## 致谢

简历编辑器复用并改造了 [JadeAI](https://github.com/LingyiChen-AI/JadeAI) 的部分设计思路和实现概念。JadeAI 使用 Apache License 2.0；对应许可证副本保存在 `third-party/JadeAI-LICENSE.txt`。

## 许可证

录阶使用 [Apache License 2.0](LICENSE) 开源。第三方声明见 [NOTICE](NOTICE)。
