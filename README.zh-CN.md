<p align="center">
  <img src="public/brand/lujie-mark.svg" alt="录阶标识" width="72" />
</p>

<h1 align="center">录阶 / LuJie CareerKit</h1>

<p align="center">
  <strong>帮助你从简历编辑到 Offer 录用的 AI 驱动求职工作台，覆盖简历编辑、JD 匹配、投递跟进、模拟面试和面试复盘。</strong>
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

录阶面向实习、校招和职业求职场景，把简历编辑、岗位匹配、投递管理、面试练习和 AI 复盘放在同一个 AI 驱动的求职工作台里。你可以围绕不同岗位维护多份简历版本，用 JD 快速生成更贴合岗位的表达，记录每一次投递进展，并在面试前后持续沉淀回答、反馈和复盘材料。

## 在线预览

访问 [https://lujie.chozzc.dev](https://lujie.chozzc.dev) 体验在线预览。

## 界面预览

| **控制中心** | **简历库** |
| --- | --- |
| ![控制中心](public/images/01-dashboard.png) | ![简历库](public/images/02-resume-library.png) |
| **简历编辑器** | **JD 匹配优化** |
| ![简历编辑器](public/images/03-resume-editor.png) | ![JD 匹配优化](public/images/04-jd-match.png) |
| **JD 匹配优化简历** | **面试助手** |
| ![JD 匹配优化简历](public/images/05-jd-optimized-resume.png) | ![面试助手](public/images/06-interview-assistant.png) |
| **模拟面试** | **AI 复盘** |
| ![模拟面试](public/images/07-mock-interview.png) | ![AI 复盘](public/images/08-ai-review.png) |
| **投递岗位跟进** | **投递状态** |
| ![投递岗位跟进](public/images/09-application-pipeline.png) | ![投递状态](public/images/10-pipeline-status.png) |

## 功能亮点

- **结构化简历编辑**：维护多份简历版本，编辑教育、实习、项目、技能等模块，切换模板和主题，并导出 PDF、PNG 或可编辑 DOCX。
- **AI 优化简历**：在简历编辑器里一键生成通用优化版本，对比优化前后差异，并继续用原模板微调。
- **JD 匹配优化**：粘贴目标岗位 JD，让 AI 在不编造经历的前提下重排重点、优化表达，生成岗位定制版本。
- **投递进展管理**：记录公司、岗位、渠道、阶段、截止日期、跟进日期、优先级、备注、JD 和绑定简历版本。
- **模拟面试与复盘**：根据简历和 JD 生成面试题，保存逐题回答，并生成可回看、可继续改进的 AI 复盘报告。
- **数据与隐私可控**：简历、岗位、投递和设置保存在本机 SQLite 数据库里，适合个人长期维护。

## 数据与隐私

- 简历、版本、岗位、投递、面试和设置保存在 `prisma/dev.db`。
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

使用 `latest` 会跟随最新的 `main` 构建；如果想固定到当前已发布的 Docker 版本，可以把镜像标签换成 `v0.1.6`。

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

### v0.1.8

- 画布支持左键和中键拖动，滚轮可继续缩放。
- 精简投递跟进：移除求职优先级，控制中心按近期待办日期展示。
- 更新内置示例投递的日期和备注；AI 功能开关默认开启，仍需先配置可用的模型服务和 API Key。
- 清理重复的语言设置，统一由顶栏切换。

### v0.1.7

- 工作经历和项目经历支持上传 Logo，或选择常用内置图标。
- 主题编辑支持以小、中、大调整 Logo / 图标大小，并实时作用到支持该功能的简历预览。

### v0.1.6

- 修复控制中心的到期跟进计算：已投递且未设置下次跟进时，按投递后 7 天作为建议跟进日。
- 优先处理列表会为已到期事项显示“已到期”，并补充对应的浅色背景提示。
- 更新 Docker 固定版本说明，可使用 `ghcr.io/chozzc/lujie-careerkit:v0.1.6`。

### v0.1.5

- 加入中英文双语界面，支持在应用内切换语言。
- 完成主工作台、控制中心、简历库、设置、JD 匹配优化、面试助手、投递跟进和简历编辑器核心控件的双语文案。
- 切换语言时不自动改写用户简历、JD、投递记录和本地数据。
- 修复多语言改造过程中发现的测试与构建配置问题。

### v0.1.4

- 新增 Docker 构建支持，并将 SQLite 持久化数据挂载到 `/data`。
- 新增 `docker-compose.yml`，支持本地一条命令启动。
- 新增 GitHub Actions workflow，发布 `ghcr.io/chozzc/lujie-careerkit:latest` 和版本标签镜像。

### v0.1.3

- 新增简历编辑器内的 AI 优化简历入口，可在不依赖 JD 的情况下生成通用优化版本。
- 复用 JD 匹配优化的结果工作台，展示优化前后对比、修改摘要和可见差异高亮。
- 优化 AI 输出兼容性与错误提示，兼容模型直接返回完整简历 JSON，并避免把内部字段名暴露给用户。
- 将 AI 优化生成的版本纳入历史优化版本，便于回看、对比和继续编辑。

### v0.1.2

- 拆分 JD 匹配优化结果页，将简历对比、摘要说明和高亮逻辑沉淀为共享组件。
- 清理匹配页中重复的预览对比代码，减少后续维护同类工作台页面时的重复改动。
- 调整应用页头、简历工作台和优化版本记录的协作方式，为 AI 优化简历功能预留稳定入口。

### v0.1.1

- 统一简历编辑器、JD 匹配优化和面试助手的简历导入配置提醒与本地兜底说明。
- 优化外部简历导入体验：导入按钮状态、解析等待提示、导入完成提醒和解析后命名逻辑。
- 修复清空数据后的阿里百炼 / Qwen 默认配置、AI 设置保存后的测试状态保留，以及示例岗位来源分布。
- 修复配置提醒弹窗底部按钮布局溢出问题。

### v0.1.0

- 初始开源版本，包含简历库、结构化简历编辑器、JD 匹配优化、投递跟进、模拟面试、AI 复盘和本地 SQLite 数据存储。

## 常见问题

### 1. 必须配置 API Key 才能使用吗？

不是。简历编辑、投递跟进等基础功能可以本地使用；JD 匹配、模拟面试、AI 复盘等 AI 功能需要配置 OpenAI-compatible 服务的 API Key。

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
