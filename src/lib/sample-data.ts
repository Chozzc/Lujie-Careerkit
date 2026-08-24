import type { InterviewPreparation } from "./interview-preparation";
import type {
  InterviewAnswers,
  InterviewQuestion,
  InterviewReport,
} from "./interview";
import type { ApplicationRecord, JobRecord, ResumeContent } from "./types";

type SampleResumeVersion = {
  id: string;
  jobId: string | null;
  name: string;
  summary: string;
  content: ResumeContent;
};

export const sampleResume: ResumeContent = {
  basics: {
    name: "",
    email: "",
    phone: "",
    city: "",
    links: [],
  },
  profile: {
    title: "AI 数据与模型评测方向",
    summary:
      "人工智能专业本科在读，具备大模型数据分析、质量评测与推荐系统实验经验，能够使用 SQL / Python 完成数据诊断，并将分析结论转化为可执行的产品改进方案。",
  },
  education: [],
  experiences: [],
  internships: [],
  projects: [],
  skills: [],
  awards: [],
  selfReview: "",
};

const jiangHeResume: ResumeContent = {
  editor: {
    displayName: "姜禾的简历",
    template: "academic",
    themeConfig: {
      primaryColor: "#111827",
      accentColor: "#315f92",
      fontFamily: "Inter",
      fontSize: "medium",
      logoSize: "medium",
      lineSpacing: 1.5,
      margin: {
        top: 20,
        right: 24,
        bottom: 20,
        left: 24,
      },
      sectionSpacing: 16,
      avatarStyle: "oneInch",
    },
  },
  basics: {
    name: "姜禾",
    email: "jianghe@example.com",
    phone: "138 2100 1100",
    city: "北京",
    links: ["github.com/jianghe", "portfolio.example.com"],
  },
  profile: {
    title: "",
    summary: "",
  },
  education: [
    {
      school: "北京邮电大学",
      degree: "本科",
      major: "人工智能",
      start: "2023",
      end: "2027",
      highlights: [
        "GPA 3.8/4.0",
        "核心课程：数据结构、数据库、机器学习、软件工程",
      ],
    },
  ],
  experiences: [
    {
      company: "校内创新实验室",
      role: "算法实验助理",
      start: "2024-10",
      end: "至今",
      highlights: [
        "围绕校园知识问答场景拆解用户需求，设计意图分类、失败样本归因和离线评测方案，沉淀 6 类核心问题标签。",
        "协调 4 名成员完成 3 轮原型验证，建立实验记录与指标看板，将单轮评测整理时间由 2 天缩短至 4 小时。",
      ],
    },
  ],
  internships: [
    {
      company: "百度",
      role: "大模型算法工程师实习生",
      start: "2025-06",
      end: "2025-09",
      highlights: [
        "使用 SQL / Python 清洗并分析 18,000 余条用户反馈与模型调用记录，建立问题类型、影响场景和严重程度三层标签体系。",
        "抽样复核 1,200 条回答并组织双人一致性校验，定位知识时效、指令遵循和安全拒答三类高频失败，形成周度质量看板。",
        "将分析结论整理为问题说明、影响范围、候选方案和验收指标，协同产品与算法推进 2 项优化进入迭代排期。",
      ],
    },
  ],
  projects: [
    {
      name: "课程推荐系统实验",
      role: "算法与评估负责人",
      highlights: [
        "基于 12,000 余条匿名课程交互记录完成数据清洗、特征分析与冷启动规则设计，明确点击率和 Recall@20 为核心离线指标。",
        "使用 Python 搭建协同过滤基线并完成分层评测，Recall@20 相比热门推荐基线提升 8.7%。",
        "通过误差分析发现新用户覆盖不足，补充专业与年级特征后改善冷启动结果，并将实验过程沉淀为可复现实验报告。",
      ],
    },
  ],
  skills: ["Python", "PyTorch", "机器学习", "推荐系统", "SQL", "数据分析"],
  awards: ["校级一等奖学金", "优秀学生干部"],
  selfReview:
    "对数据质量和模型效果问题保持敏感，习惯先定义业务目标与验收标准，再通过数据验证判断。能够在技术细节与产品表达之间切换，并主动记录假设、证据和复盘结论。",
};

export const sampleResumeVersions: SampleResumeVersion[] = [
  {
    id: "rv-baidu-ai-original",
    jobId: null,
    name: "姜禾的简历",
    summary: "示例简历",
    content: jiangHeResume,
  },
];

export const sampleTailoredResumeVersion = {
  id: "rv-baidu-ai-tailored",
  jobId: "cmqgua8t70000a0cwl8o3xqwn",
  name: "JD匹配优化-姜禾-百度AI数据产品实习生",
  summary: "突出 AI 数据、效果评估与跨团队协作证据的岗位定制版本。",
  content: {
    ...jiangHeResume,
    editor: {
      ...jiangHeResume.editor,
      displayName: "JD匹配优化-姜禾-百度AI数据产品实习生",
    },
    profile: {
      title: "AI 数据产品实习生",
      summary:
        "人工智能专业本科在读，具备大模型数据分析、质量评测与产品迭代经验。曾分析 18,000 余条反馈和调用记录、复核 1,200 条模型回答，并推动 2 项优化进入排期；能够使用 SQL / Python 把用户问题转化为可验证的数据方案。",
    },
    skills: [
      "Python",
      "SQL",
      "数据分析",
      "大模型评测",
      "机器学习",
      "跨团队协作",
    ],
    _tailoringBaseResume: jiangHeResume,
    _optimizationMeta: {
      company: "百度",
      title: "AI 数据产品实习生",
      keywords: ["AI 数据", "模型评测", "数据分析", "跨团队协作"],
      summary: "围绕 AI 数据产品岗位重排简历重点，保留原有事实。",
      changes: [
        "用数据规模、评测方法和推进结果补强百度实习证据",
        "将大模型数据质量与推荐系统评测经历前置",
        "围绕数据分析、模型评测和跨团队推进统一岗位关键词",
      ],
      versionName: "JD匹配优化-姜禾-百度AI数据产品实习生",
    },
  } as ResumeContent,
};

export const sampleJobs: JobRecord[] = [
  {
    id: "cmqgzt65k0003a0cwskeetbo1",
    company: "网易",
    title: "后端开发",
    city: "杭州",
    source: "实习僧",
    link: "https://campus.163.com/",
    deadline: "2026-09-18",
    jd: "岗位职责：\n1. 参与内容与社区业务后端服务的设计、开发和维护；\n2. 使用 Java / Go 完成接口开发、数据处理和性能优化；\n3. 与产品、前端和测试协作，定位线上问题并完善监控。\n岗位要求：\n1. 计算机相关专业，熟悉数据结构、网络和操作系统基础；\n2. 熟悉 MySQL、Redis，了解常见 Web 框架；\n3. 有课程项目、开源贡献或实习经验者优先。",
  },
  {
    id: "cmqgua8t70000a0cwl8o3xqwn",
    company: "百度",
    title: "AI 数据产品实习生",
    city: "北京",
    source: "BOSS直聘",
    link: "https://talent.baidu.com/jobs/list?recruitType=INTERN",
    deadline: "2026-09-20",
    jd: "岗位职责：\n1. 参与大模型数据产品的需求分析、方案设计和效果评估；\n2. 协助建设数据生产与质量评估流程，整理用户反馈并形成迭代建议；\n3. 联动算法、工程和运营团队推进功能上线与复盘。\n岗位要求：\n1. 计算机、人工智能或相关专业在读；\n2. 熟悉 SQL / Python，具备数据分析和结构化表达能力；\n3. 关注大模型应用，有模型评测、数据治理或 AI 产品项目经验者优先。",
  },
  {
    id: "cmq1p2ksn0006ui8wbyrbxega",
    company: "华为",
    title: "AI 测试实习生",
    city: "深圳",
    source: "猎聘",
    link: "https://career.huawei.com/cn/campus-recruitment-job-list",
    deadline: "2026-09-22",
    jd: "岗位职责：\n1. 参与 AI 平台与模型服务的测试方案设计和用例执行；\n2. 建设接口、性能和稳定性自动化测试，跟踪缺陷闭环；\n3. 分析测试数据，协助定位模型效果与工程链路问题。\n岗位要求：\n1. 熟悉软件测试基础、Python 和 Linux；\n2. 了解接口测试、自动化测试或持续集成；\n3. 有机器学习基础或 AI 应用测试经历者优先。",
  },
  {
    id: "cmq1p21td0003ui8wzce4qda6",
    company: "阿里巴巴",
    title: "千问大模型开发实习生",
    city: "杭州",
    source: "企业官网",
    link: "https://campus-talent.alibaba.com/campus/gov",
    deadline: "2026-09-25",
    jd: "岗位职责：\n1. 参与千问大模型应用与工具链开发，完成需求拆解、编码和验证；\n2. 优化模型调用、提示词与评测流程，提升任务完成率和稳定性；\n3. 跟踪大模型技术进展并沉淀可复用的工程组件。\n岗位要求：\n1. 熟悉 Python，掌握数据结构与算法基础；\n2. 了解大模型推理、Agent 或 RAG 等技术；\n3. 有相关项目、竞赛或开源实践者优先。",
  },
  {
    id: "cmq1ox0mq0000ui8wt80spiuh",
    company: "小红书",
    title: "Agent 运营实习生",
    city: "上海",
    source: "内推",
    link: "https://hr.xiaohongshu.com/",
    deadline: "2026-09-15",
    jd: "岗位职责：\n1. 参与 Agent 产品的用户运营、内容策划与反馈收集；\n2. 结合使用数据和用户访谈识别问题，推动产品体验优化；\n3. 维护运营流程与知识库，协同产品和算法团队完成活动复盘。\n岗位要求：\n1. 对 AI Agent 产品有持续体验和观察；\n2. 具备数据分析、内容表达和跨团队沟通能力；\n3. 有 AI 产品、社区或增长运营实践者优先。",
  },
  {
    id: "job-meituan-backend",
    company: "美团",
    title: "后端开发实习生",
    city: "北京",
    source: "智联招聘",
    link: "https://job.meituan.com/",
    deadline: "2026-09-28",
    jd: "岗位职责：\n1. 参与到店业务后端服务和数据接口开发；\n2. 完成服务监控、故障定位与性能优化；\n3. 与产品和测试协作，保障需求按期交付。\n岗位要求：\n1. 熟悉 Java、Spring、MySQL 和常用数据结构；\n2. 了解缓存、消息队列、高并发和接口设计；\n3. 有完整后端项目或实习经历者优先。",
  },
];

export const sampleApplications: ApplicationRecord[] = [
  {
    id: "cmqgzt65v0005a0cw4gpgz37f",
    jobId: "cmqgzt65k0003a0cwskeetbo1",
    status: "INTERVIEW",
    interviewRound: "FIRST",
    resumeVersionId: null,
    appliedAt: "2026-09-03",
    stageDate: "2026-09-12",
    nextFollowUpAt: null,
    notes: "已加入投递跟进。",
  },
  {
    id: "cmqgua8tg0002a0cwscbuxxq1",
    jobId: "cmqgua8t70000a0cwl8o3xqwn",
    status: "ASSESSMENT",
    resumeVersionId: sampleTailoredResumeVersion.id,
    appliedAt: "2026-09-02",
    stageDate: "2026-09-08",
    nextFollowUpAt: "2026-09-10",
    notes: "已加入投递跟进。",
  },
  {
    id: "cmq1p2ksw0008ui8wf2yh55ri",
    jobId: "cmq1p2ksn0006ui8wbyrbxega",
    status: "REJECTED",
    resumeVersionId: null,
    appliedAt: "2026-09-01",
    stageDate: "2026-09-12",
    nextFollowUpAt: null,
    notes: "已加入投递跟进。",
  },
  {
    id: "cmq1p21tm0005ui8w3u1taqyh",
    jobId: "cmq1p21td0003ui8wzce4qda6",
    status: "OFFER",
    resumeVersionId: "rv-baidu-ai-original",
    appliedAt: "2026-09-02",
    stageDate: "2026-09-20",
    nextFollowUpAt: null,
    notes: "已收到offer",
  },
  {
    id: "cmq1ox0n40002ui8w0au2hlxb",
    jobId: "cmq1ox0mq0000ui8wt80spiuh",
    status: "APPLIED",
    resumeVersionId: null,
    appliedAt: "2026-09-05",
    stageDate: "2026-09-05",
    nextFollowUpAt: "2026-09-09",
    notes: "已加入投递跟进。",
  },
  {
    id: "app-meituan-backend",
    jobId: "job-meituan-backend",
    status: "ARCHIVED",
    resumeVersionId: null,
    appliedAt: "2026-09-01",
    stageDate: "2026-09-21",
    nextFollowUpAt: null,
    notes: "流程已结束，保留记录用于复盘。",
  },
];

export const sampleInterviewPreparation = {
  id: "prep-baidu-ai-data",
  jobId: "cmqgua8t70000a0cwl8o3xqwn",
  resumeVersionId: sampleTailoredResumeVersion.id,
  mode: "comprehensive",
  context: {
    jd: sampleJobs[1].jd,
    resumeName: sampleTailoredResumeVersion.name,
    resume: sampleTailoredResumeVersion.content,
    focus: "comprehensive" as const,
    locale: "zh-CN" as const,
  },
  content: {
    meta: {
      company: "百度",
      title: "AI 数据产品实习生",
      roleFamily: "AI 数据产品",
      roleSummary:
        "岗位连接用户需求、数据生产和模型效果，需要能定义质量标准、分析失败样本，并协同算法与工程把结论推进为可验收的产品迭代。",
      assumptions: [
        "示例资料仅演示准备方法，真实面试前需核对最新岗位职责、团队业务和产品进展。",
        "简历中的数据规模与结果均按示例候选人的既有材料作答，不在面试中延伸未验证事实。",
      ],
    },
    capabilityProfile: {
      overview:
        "候选人的大模型数据分析、失败样本归因和跨团队推进经历与岗位高度相关；优势是能够从数据定位问题，主要短板是尚未独立负责完整数据产品，需要用清晰的方法论证明可迁移能力。",
      dimensions: [
        {
          label: "数据分析",
          requirementLevel: "core",
          evidenceLevel: "strong",
          evidenceSummary: "使用 SQL / Python 分析 18,000 余条业务记录，并完成推荐系统分层评测。",
          nextStep: "准备字段定义、清洗规则、异常处理和指标选择的完整追问链路。",
        },
        {
          label: "模型评测",
          requirementLevel: "core",
          evidenceLevel: "strong",
          evidenceSummary: "复核 1,200 条回答、组织一致性校验，并按失败类型形成周度质量看板。",
          nextStep: "补充抽样代表性、标注一致性阈值和线上指标联动方式。",
        },
        {
          label: "产品思维",
          requirementLevel: "important",
          evidenceLevel: "partial",
          evidenceSummary: "能够把分析结论整理为问题、影响范围、方案与验收指标，并推动 2 项优化排期。",
          nextStep: "明确为什么优先做这两项，以及上线后如何判断改进有效。",
        },
        {
          label: "协作推进",
          requirementLevel: "important",
          evidenceLevel: "strong",
          evidenceSummary: "曾联动产品和算法对齐问题定义、优先级和验收口径。",
          nextStep: "准备一次存在分歧的具体场景，讲清个人判断、沟通和结果。",
        },
        {
          label: "AI 理解",
          requirementLevel: "bonus",
          evidenceLevel: "partial",
          evidenceSummary: "具备机器学习课程基础、推荐系统实验和真实大模型业务数据经验。",
          nextStep: "复习训练数据、评测集与线上反馈的边界，避免只谈抽象概念。",
        },
      ],
    },
    evidenceMatrix: [
      {
        requirement: "数据分析与效果评估",
        resumeEvidence: ["分析 18,000 余条反馈与调用记录", "完成 1,200 条回答抽样复核"],
        state: "direct",
        assessment: "具备从数据清洗、分类归因到评测看板的直接证据。",
        action: "按目标、数据、方法、发现、决策和验证六步复述百度案例。",
      },
      {
        requirement: "跨团队推进",
        resumeEvidence: ["将问题说明、影响范围、候选方案与验收指标写入评审材料", "推动 2 项优化进入排期"],
        state: "direct",
        assessment: "能够体现推动结果。",
        action: "讲清产品与算法最初的分歧、自己补充了什么证据以及最终如何达成一致。",
      },
      {
        requirement: "AI 数据产品理解",
        resumeEvidence: ["大模型业务失败样本归因", "推荐系统离线评测与冷启动分析"],
        state: "transferable",
        assessment: "技术背景可迁移，产品方法仍需显性表达。",
        action: "用数据进入系统后的采集、生产、质检、评测、上线反馈和回流解释完整闭环。",
      },
    ],
    knowledgeTopics: [
      {
        topic: "大模型评测",
        priority: "must",
        whyRelevant: "岗位直接涉及效果评估。",
        explanation: "离线评测回答模型是否达到既定标准，线上指标验证真实用户价值；人工评测用于覆盖帮助度、安全性等难以完全自动化的维度。",
        currentEvidence: "有抽样复核、失败分类与一致性校验经验。",
        targetLevel: "能够从业务目标出发设计样本、维度、评分规则、一致性检查和结果回流。",
        selfCheckQuestions: ["如何保证评测集具有代表性？", "评分者意见不一致时如何处理？", "离线分数提升但用户投诉增加时如何判断？"],
      },
      {
        topic: "数据质量",
        priority: "must",
        whyRelevant: "数据生产质量影响模型表现。",
        explanation: "从完整性、准确性、一致性、覆盖度、时效性和合规性定义质量，并区分采集、清洗、标注、存储和模型消费各环节责任。",
        currentEvidence: "有三层标签、抽样复核和双人一致性检查经验。",
        targetLevel: "能够为一个具体场景给出质量指标、抽检策略、异常升级和闭环机制。",
        selfCheckQuestions: ["低频高风险样本如何进入抽检？", "如何区分标注噪声和模型能力问题？", "质量规则变化后如何重算历史数据？"],
      },
      {
        topic: "产品闭环",
        priority: "should",
        whyRelevant: "岗位需要推动迭代。",
        explanation: "从用户场景与业务目标出发，把问题量化为指标，再通过方案评审、灰度验证和复盘形成可持续迭代。",
        currentEvidence: "有问题归因、影响评估和推动排期经历，尚缺独立负责上线后的完整证据。",
        targetLevel: "能够区分用户反馈、问题现象和根因，并说明优先级与验收标准。",
        selfCheckQuestions: ["如何比较频率低但风险高的问题？", "方案上线后应看领先指标还是结果指标？"],
      },
    ],
    deepDives: [
      {
        resumeItem: "百度大模型算法实习",
        whyRelevant: "最接近目标岗位场景。",
        personalContributionFocus: "标签体系设计、SQL / Python 分析、失败样本复核以及评审材料整理。",
        likelyFollowUps: ["18,000 条数据包含哪些字段？", "1,200 条样本如何抽取？", "两项建议为什么优先？", "你如何证明问题不是偶发现象？"],
        factsToConfirm: ["抽样分层与一致性计算方式", "两项优化的实际验收指标", "本人和导师各自负责边界"],
      },
      {
        resumeItem: "课程推荐系统实验",
        whyRelevant: "可验证数据分析与产品判断。",
        personalContributionFocus: "数据清洗、基线搭建、Recall@20 分层评测和冷启动误差分析。",
        likelyFollowUps: ["为什么选择 Recall@20？", "如何避免数据泄漏？", "8.7% 提升如何计算？", "冷启动规则有什么代价？"],
        factsToConfirm: ["训练验证切分方式", "热门推荐基线定义", "冷启动特征的可用性"],
      },
    ],
    targetedQuestions: [
      {
        question: "请用两分钟介绍你与 AI 数据产品最相关的经历。",
        category: "自我介绍",
        preparationDirection: "围绕百度实习与数据闭环展开。",
        priority: "must",
      },
      {
        question: "为什么选择 AI 数据产品方向？",
        category: "岗位动机",
        preparationDirection: "连接技术背景、用户价值和长期兴趣。",
        priority: "must",
      },
      {
        question: "你会如何设计一套大模型回答质量评测方案？",
        category: "专业能力",
        preparationDirection: "说明指标、样本、人工标准和复盘。",
        priority: "must",
      },
      {
        question: "举例说明你如何把分析结论推动到产品迭代。",
        category: "项目深挖",
        preparationDirection: "强调个人贡献与协作过程。",
        priority: "must",
      },
      {
        question: "当算法与产品对优先级判断不一致时你会怎么做？",
        category: "行为面试",
        preparationDirection: "用事实、目标和小规模验证推进共识。",
        priority: "should",
      },
      {
        question: "你会向面试官了解哪些团队信息？",
        category: "面试反问",
        preparationDirection: "关注数据闭环、实习生职责和评价标准。",
        priority: "should",
      },
    ],
    preparationPlan: {
      mustPrepare: ["90 秒岗位定制自我介绍", "百度实习完整追问链路", "大模型评测方案", "数据质量归因框架"],
      shouldPrepare: ["推荐系统项目的指标选择与失败尝试", "跨团队分歧案例", "岗位动机与百度业务理解"],
      optional: ["近期体验过的 AI 数据产品及改进建议", "可向面试官确认的团队协作与评价机制"],
    },
    selfIntroduction:
      "面试官您好，我是姜禾，目前就读于北京邮电大学人工智能专业。过去的经历主要围绕数据如何帮助模型和产品做出更可靠的判断展开。在百度实习期间，我使用 SQL 和 Python 分析 18,000 余条用户反馈与调用记录，抽样复核 1,200 条回答，建立问题类型、影响场景和严重程度三层标签，并协同产品与算法推动 2 项优化进入排期。在课程推荐系统中，我负责数据清洗和离线评测，通过分层误差分析改善冷启动表现。这些经历让我确认自己希望做连接用户问题、数据方法和模型效果的 AI 数据产品工作，也期待在这个岗位上进一步参与完整的数据生产与评测闭环。",
    reverseQuestions: [
      "团队当前的数据产品主要服务哪些模型或业务场景，最希望优先解决的质量问题是什么？",
      "这个岗位会如何与算法、工程和运营协作，实习生能否参与从问题定义到上线复盘的完整环节？",
      "如果我加入团队，前三个月最重要的交付物和评价标准分别是什么？",
    ],
  } satisfies InterviewPreparation,
};

export const sampleInterviewSession = {
  id: "interview-baidu-ai-data",
  jobId: "cmqgua8t70000a0cwl8o3xqwn",
  resumeVersionId: sampleTailoredResumeVersion.id,
  mode: "comprehensive",
  status: "COMPLETED",
  context: {
    company: "百度",
    title: "AI 数据产品实习生",
    jd: sampleJobs[1].jd,
    resumeName: sampleTailoredResumeVersion.name,
    resume: sampleTailoredResumeVersion.content,
  },
  questions: [
    {
      id: "q-1",
      category: "self-introduction",
      prompt: "请用两分钟介绍你与 AI 数据产品最相关的经历。",
      focus: "自我介绍",
      order: 0,
    },
    {
      id: "q-2",
      category: "motivation",
      prompt: "为什么选择 AI 数据产品方向和这个岗位？",
      focus: "岗位动机",
      order: 1,
    },
    {
      id: "q-3",
      category: "professional",
      prompt: "你会如何设计一套大模型回答质量评测方案？",
      focus: "模型评测",
      order: 2,
    },
    {
      id: "q-4",
      category: "project",
      prompt: "请深挖一次你把数据分析结论推动到迭代排期的经历。",
      focus: "项目职责",
      order: 3,
    },
    {
      id: "q-5",
      category: "professional",
      prompt: "你如何判断数据质量问题来自采集、标注还是模型环节？",
      focus: "专业能力",
      order: 4,
    },
    {
      id: "q-6",
      category: "behavioral",
      prompt: "当团队成员对问题优先级意见不一致时，你会怎么推进？",
      focus: "团队协作",
      order: 5,
    },
    {
      id: "q-7",
      category: "failure",
      prompt: "分享一次分析结论没有达到预期的经历，以及你的复盘。",
      focus: "失败复盘",
      order: 6,
    },
    {
      id: "q-8",
      category: "reverse-question",
      prompt: "你还有什么问题想向面试官了解？",
      focus: "面试反问",
      order: 7,
    },
  ] satisfies InterviewQuestion[],
  answers: {
    "q-1": {
      questionId: "q-1",
      content:
        "面试官您好，我是姜禾，目前就读于北京邮电大学人工智能专业。我的核心经历是把模型问题转化为可分析的数据，再把分析结论推进为产品改进。在百度实习期间，我使用 SQL 和 Python 清洗并分析 18,000 余条用户反馈与调用记录，抽样复核 1,200 条回答，建立问题类型、影响场景和严重程度三层标签。基于这些证据，我协同产品和算法推动了 2 项优化进入排期。课程项目中，我还负责推荐系统的数据清洗和离线评测，通过误差分析改善冷启动表现。因为这些经历，我希望继续从事连接用户需求、数据质量和模型效果的 AI 数据产品工作。",
      skipped: false,
      updatedAt: "2026-08-20T10:00:00.000Z",
    },
    "q-2": {
      questionId: "q-2",
      content:
        "我选择 AI 数据产品，不是因为它只是 AI 和产品的组合，而是因为这个岗位需要把用户表达不清的问题转化为可定义、可采集、可评测的数据任务。我在百度实习时发现，同一个‘回答不好’的反馈，背后可能是知识过期、指令遵循不足或安全策略误判，只有建立清晰的标签和评测标准，算法与产品才能讨论同一个问题。这个过程很符合我的优势：我有人工智能基础，能够理解模型边界，也愿意通过数据分析和跨团队沟通推动落地。百度拥有真实的大规模搜索与 AI 应用场景，我希望进一步学习如何把离线质量、线上反馈和产品决策连接成完整闭环。",
      skipped: false,
      updatedAt: "2026-08-20T10:05:00.000Z",
    },
    "q-3": {
      questionId: "q-3",
      content:
        "我会先明确评测服务的业务决策，例如比较两个模型版本，还是判断一个版本能否上线；目标不同，指标权重也不同。第二步按真实流量、核心场景和高风险长尾分层抽样，建立冻结测试集，并单独维护从线上投诉回流的挑战集。第三步把质量拆成事实准确、指令遵循、帮助度、安全性和稳定性，为每个维度给出正反例和可操作的评分锚点。主观题采用双人盲评，计算一致性，分歧样本交由第三人仲裁。自动指标适合做大规模筛查，但不能替代人工判断。最后我会同时看总体分、关键场景最低线和错误分布，并与采纳率、重试率、投诉率等线上指标交叉验证。每次版本复盘后把新失败样本回流到挑战集，避免评测集只覆盖旧问题。",
      skipped: false,
      updatedAt: "2026-08-20T10:10:00.000Z",
    },
    "q-4": {
      questionId: "q-4",
      content:
        "在百度实习中，团队收到的用户反馈比较分散，大家知道模型存在问题，但很难判断先改什么。我的任务是把反馈变成可比较的证据。我先用 SQL 合并 18,000 余条反馈和调用记录，再抽样复核 1,200 条回答，按问题类型、影响场景和严重程度建立三层标签。分析后发现，知识时效问题频率高但集中在少数场景，而指令遵循问题覆盖更广、对任务完成率影响更直接。我把结论整理成问题定义、代表案例、影响范围、候选方案和验收指标，并与产品、算法逐项核对。评审中有人担心样本偏差，我补做了按入口和用户类型的分层校验。最终团队优先排入两项改进。我的贡献不是决定算法方案，而是让优先级讨论建立在统一、可复核的数据证据上。",
      skipped: false,
      updatedAt: "2026-08-20T10:15:00.000Z",
    },
    "q-5": {
      questionId: "q-5",
      content:
        "我会先把链路拆成采集、清洗、标注、存储、模型输入和模型输出六个环节，再用对照样本逐层排除。首先检查原始日志是否缺失、截断或分布突变，确认采集完整性；其次比较清洗前后数据量与字段分布，排查规则误删和格式转换；标注环节通过金标样本、双人一致性和分歧类型判断标准是否模糊。如果输入数据和标签都稳定，我会固定同一批样本对不同模型版本复现，结合置信度、错误类型和日志定位模型能力或工程链路问题。高风险问题不会只看平均值，而会单独设拦截阈值。最后记录问题首次出现的版本、影响范围和复现条件，让责任团队可以验证修复，而不是只得到一句‘数据质量不好’。",
      skipped: false,
      updatedAt: "2026-08-20T10:20:00.000Z",
    },
    "q-6": {
      questionId: "q-6",
      content:
        "我会先确认分歧来自目标不同、证据不同，还是资源约束不同，而不是立刻争论方案。在百度的反馈分析中，产品更关注用户投诉频率，算法更关注问题是否能通过当前版本解决。我先把候选问题放进统一表格，用影响用户数、严重程度、解决成本和验证周期四个维度比较，并把不确定项明确标出来。对仍有争议的项目，我建议先做一周的小样本验证：补充分层抽样，确认问题覆盖范围，再决定是否进入正式排期。这样既没有要求某一方凭感觉让步，也避免为了追求完整证据拖延决策。最终两项证据较充分、验证成本可控的改进进入排期，其他问题进入持续观察清单。",
      skipped: false,
      updatedAt: "2026-08-20T10:25:00.000Z",
    },
    "q-7": {
      questionId: "q-7",
      content:
        "在课程推荐系统的第一版实验中，我只按总体 Recall@20 比较模型，结果虽然高于热门推荐基线，但演示时新用户的推荐明显不稳定。复盘后发现，我把全量平均指标当成了全部用户体验，没有按历史交互数量分层，也没有提前定义冷启动验收标准。我随后把用户分成无历史、低活跃和高活跃三组，重新检查覆盖率与 Recall，并为无历史用户补充专业、年级和课程热度规则。调整后总体提升幅度略有回落，但新用户覆盖明显更稳定。这个经历让我形成两个习惯：评测前先明确关键用户分层和最低线；结果看起来很好时，主动检查平均值是否掩盖了局部失败。",
      skipped: false,
      updatedAt: "2026-08-20T10:30:00.000Z",
    },
    "q-8": {
      questionId: "q-8",
      content:
        "我想了解三个方面。第一，团队当前的数据产品主要服务哪些模型或业务场景，现阶段最希望优先解决的质量问题是什么？第二，这个岗位与算法、工程和运营通常如何协作，实习生是否有机会参与从问题定义、方案设计到上线复盘的完整环节？第三，如果我加入团队，前三个月最重要的交付物和评价标准分别是什么？我希望根据真实工作目标尽快补齐需要的业务知识和方法。",
      skipped: false,
      updatedAt: "2026-08-20T10:35:00.000Z",
    },
  } satisfies InterviewAnswers,
  feedback: {
    overallScore: 86,
    dimensions: { jobFit: 90, structure: 86, evidence: 84, star: 83 },
    strengths: [
      "岗位匹配度较高：能够把人工智能背景、业务数据分析和产品推进串成稳定主线，而不是简单罗列技能。",
      "专业题回答有完整方法：评测方案覆盖目标、抽样、维度、人工一致性、线上验证和失败样本回流。",
      "项目回答具备可核验的规模、方法和个人边界，能主动区分‘提供决策证据’与‘决定算法方案’。",
      "面对分歧与失败时没有回避问题，能够说明如何补证据、调整指标并形成后续工作习惯。",
    ],
    improvements: [
      "百度案例仍需在真实面试前确认抽样分层、一致性计算方式和两项优化的最终验收结果，避免被追问时超出已有事实。",
      "部分回答偏长，正式面试应先给结论，再按两到三个关键步骤展开，把单题控制在 90 秒至 2 分钟。",
      "岗位动机对百度具体业务的理解仍较概括，可在面试前补充目标产品、用户场景和近期公开进展。",
      "推荐系统案例应准备训练验证切分、热门基线定义和 Recall@20 选择依据，以应对技术细节追问。",
    ],
    questionReviews: [
      {
        questionId: "q-1",
        diagnosis: "主线、数据规模和岗位动机完整，但信息密度较高，口头表达容易超过两分钟。",
        suggestion: "保留‘我是谁—百度案例—课程项目—为什么匹配’四段，每段只讲一个结论。",
        improvedAnswer:
          "面试官您好，我是北京邮电大学人工智能专业的姜禾。我的核心经历是用数据定位模型问题，并推动产品改进。在百度实习期间，我分析 18,000 余条业务记录、复核 1,200 条回答，建立三层问题标签，并协同产品与算法推动 2 项优化进入排期；课程项目中，我负责推荐系统的离线评测与冷启动分析。我希望继续做连接用户需求、数据质量和模型效果的 AI 数据产品工作。",
      },
      {
        questionId: "q-2",
        diagnosis: "能够解释岗位价值和个人匹配，但对目标公司与具体业务场景的回答还不够独特。",
        suggestion: "面试前选择一个真实百度 AI 产品，补充用户、关键数据问题和自己希望参与的环节。",
        improvedAnswer:
          "我选择 AI 数据产品，是因为这个岗位把模糊用户反馈转化为可定义、可评测的数据任务，这与我在百度实习中的经历高度一致。我希望在百度真实的大规模 AI 应用场景中，进一步学习如何把离线质量、线上反馈与产品决策连接起来；面试前我也会结合目标团队的具体产品说明最希望参与的数据闭环。",
      },
      {
        questionId: "q-3",
        diagnosis: "框架完整且专业，但维度较多，若不先说明业务决策，容易像背诵评测清单。",
        suggestion: "第一句话先确认评测要支持什么决策，再用一个具体场景解释指标权重和上线门槛。",
        improvedAnswer:
          "如果目标是判断客服问答模型能否上线，我会先把事实准确和安全设为硬门槛，再评估帮助度与稳定性；随后按真实流量、核心任务和高风险长尾分层抽样，使用带正反例的评分规则进行双人盲评，并把分歧样本仲裁。最后将离线结果与采纳率、重试率和投诉率交叉验证，把新的线上失败样本回流到挑战集。",
      },
      {
        questionId: "q-4",
        diagnosis: "数据、行动和协作边界清晰，但尚未说明两项优化进入排期后的实际结果。",
        suggestion: "如有真实上线结果则补充；若实习结束前尚未上线，应明确只陈述到排期阶段。",
        improvedAnswer:
          "我通过 18,000 余条记录和 1,200 条复核样本定位高频失败，再补做入口与用户分层校验，最终把问题定义、影响范围、候选方案和验收指标提交评审，推动 2 项优化进入排期。我的职责是提供可复核的优先级证据；若面试官追问上线效果，我会如实说明当时跟进到的阶段。",
      },
      {
        questionId: "q-5",
        diagnosis: "归因链路完整，能区分数据与模型问题，但缺少一个实际定位案例帮助面试官快速理解。",
        suggestion: "补充一次通过清洗前后分布或固定样本跨版本对照定位根因的具体例子。",
        improvedAnswer:
          "我会先拆分采集、清洗、标注和模型环节。比如某类回答准确率突然下降，我先比较原始日志与清洗后字段分布；若数据稳定，再用固定样本复现不同模型版本；若模型表现一致，则检查标签规则与双人一致性。每一步都保留对照组和复现条件，最终给责任团队一个可验证的根因，而不是笼统归为数据问题。",
      },
      {
        questionId: "q-6",
        diagnosis: "能够把团队分歧转化为统一指标和小规模验证，体现协作成熟度。",
        suggestion: "进一步突出自己如何主持对齐，以及验证结果具体改变了哪一方的判断。",
        improvedAnswer:
          "面对优先级分歧，我先确认各方目标，再用影响用户数、严重程度、解决成本和验证周期统一比较口径。对证据不足的问题，我提出一周分层抽样验证，并负责整理结果。验证证明指令遵循问题覆盖更广后，团队同意优先排期两项改进，其他问题进入观察清单。",
      },
      {
        questionId: "q-7",
        diagnosis: "失败原因、纠正动作和方法沉淀完整，是较可信的复盘回答。",
        suggestion: "补充调整后新用户覆盖或稳定性的具体指标；没有可靠数字时不要临时估算。",
        improvedAnswer:
          "第一版推荐系统只看总体 Recall@20，掩盖了新用户推荐不稳定。我按交互量重新分层，补充新用户覆盖指标，并加入专业、年级与课程热度规则。虽然总体提升略有回落，但冷启动表现更稳定。此后我会在实验前定义关键人群最低线，并主动检查平均值是否掩盖局部失败。",
      },
      {
        questionId: "q-8",
        diagnosis: "反问覆盖业务问题、协作方式和评价标准，体现了对实际工作的关注。",
        suggestion: "现场根据前文选择两题即可，避免连续提问过多；优先追问面试官尚未介绍的内容。",
        improvedAnswer:
          "我想重点了解两个问题：团队当前最希望优先解决的数据质量问题是什么？如果我加入，前三个月最重要的交付物和评价标准分别是什么？如果时间允许，我还想了解这个岗位与算法、工程和运营的日常协作方式。",
      },
    ],
    nextActions: [
      "逐项核对百度案例中的数据规模、抽样方式、一致性方法和项目边界，只保留能够被追问验证的事实。",
      "将自我介绍、岗位动机和项目深挖分别录音两遍，压缩到目标时长并检查是否先给结论。",
      "补充百度目标团队或产品的公开信息，形成一页‘用户场景—数据问题—岗位贡献’笔记。",
      "为推荐系统准备训练验证切分、基线定义、Recall@20 选择和冷启动改进四个技术追问。",
      "按问题目录再模拟一轮，只重点练习 q-3、q-4、q-5 和 q-7，并重新生成复盘比较改进。",
    ],
  } satisfies InterviewReport,
  currentQuestionIndex: 7,
  completedAt: "2026-08-20T10:40:00.000Z",
};
