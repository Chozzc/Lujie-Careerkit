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
    title: "",
    summary: "",
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
        "负责需求拆解、数据整理和实验复盘，形成可复用的项目文档与指标看板。",
        "与 4 名同学协作完成原型、开发和验证流程，将关键任务完成时间缩短 20%。",
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
        "参与真实业务项目，负责资料整理、功能验证和日报复盘，沉淀 3 份流程文档。",
        "基于用户反馈和数据结果提出优化建议，其中 2 项进入后续迭代排期。",
      ],
    },
  ],
  projects: [
    {
      name: "课程推荐系统实验",
      role: "算法与评估负责人",
      highlights: [
        "梳理业务目标和用户路径，完成问题定义、方案设计和效果验证。",
        "使用 SQL / Python 处理实验数据，输出结论并推动团队调整优先级。",
        "整理演示材料和复盘报告，支持项目在课程答辩中获得优秀评级。",
      ],
    },
  ],
  skills: ["Python", "PyTorch", "机器学习", "推荐系统", "SQL", "数据分析"],
  awards: ["校级一等奖学金", "优秀学生干部"],
  selfReview:
    "人工智能专业学生，熟悉 Python、机器学习基础和推荐系统实验流程，关注模型效果与业务指标之间的连接。\n希望在真实业务场景中继续提升工程实践、数据分析和跨团队协作能力。",
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
        "人工智能专业本科在读，具备大模型业务实习、数据整理、效果评估和跨团队协作经验。",
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
        "强化数据整理和效果评估证据",
        "将相关实习与项目经历前置",
        "统一岗位关键词",
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
    appliedAt: "2026-06-17",
    stageDate: "2026-07-12",
    nextFollowUpAt: null,
    notes: "已加入投递跟进。",
  },
  {
    id: "cmqgua8tg0002a0cwscbuxxq1",
    jobId: "cmqgua8t70000a0cwl8o3xqwn",
    status: "ASSESSMENT",
    resumeVersionId: sampleTailoredResumeVersion.id,
    appliedAt: "2026-06-16",
    stageDate: "2026-07-15",
    nextFollowUpAt: "2026-09-05",
    notes: "已加入投递跟进。",
  },
  {
    id: "cmq1p2ksw0008ui8wf2yh55ri",
    jobId: "cmq1p2ksn0006ui8wbyrbxega",
    status: "REJECTED",
    resumeVersionId: null,
    appliedAt: "2026-06-16",
    stageDate: "2026-07-02",
    nextFollowUpAt: null,
    notes: "已加入投递跟进。",
  },
  {
    id: "cmq1p21tm0005ui8w3u1taqyh",
    jobId: "cmq1p21td0003ui8wzce4qda6",
    status: "OFFER",
    resumeVersionId: "rv-baidu-ai-original",
    appliedAt: "2026-06-18",
    stageDate: "2026-07-28",
    nextFollowUpAt: null,
    notes: "已收到offer",
  },
  {
    id: "cmq1ox0n40002ui8w0au2hlxb",
    jobId: "cmq1ox0mq0000ui8wt80spiuh",
    status: "APPLIED",
    resumeVersionId: null,
    appliedAt: "2026-07-07",
    stageDate: "2026-07-07",
    nextFollowUpAt: "2026-09-01",
    notes: "已加入投递跟进。",
  },
  {
    id: "app-meituan-backend",
    jobId: "job-meituan-backend",
    status: "ARCHIVED",
    resumeVersionId: null,
    appliedAt: "2026-06-09",
    stageDate: "2026-06-27",
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
        "岗位需要把模型数据、效果评估和用户反馈转化为可执行的产品迭代。",
      assumptions: ["示例资料仅用于演示，真实面试前需核对最新岗位信息。"],
    },
    capabilityProfile: {
      overview:
        "候选人的数据整理和模型业务经历与岗位相关，产品化表达与量化证据仍需加强。",
      dimensions: [
        {
          label: "数据分析",
          requirementLevel: "core",
          evidenceLevel: "strong",
          evidenceSummary: "具备 SQL、Python 与实验数据处理经历。",
          nextStep: "准备一段从数据到结论的完整案例。",
        },
        {
          label: "模型评测",
          requirementLevel: "core",
          evidenceLevel: "partial",
          evidenceSummary: "参与功能验证和结果复盘，但评测指标描述较少。",
          nextStep: "补充指标选择与误差分析方法。",
        },
        {
          label: "产品思维",
          requirementLevel: "important",
          evidenceLevel: "partial",
          evidenceSummary: "能够拆解需求并提出迭代建议。",
          nextStep: "用用户问题、方案和结果串联案例。",
        },
        {
          label: "协作推进",
          requirementLevel: "important",
          evidenceLevel: "strong",
          evidenceSummary: "有跨角色协作与推动排期的经历。",
          nextStep: "说明个人决策和具体贡献。",
        },
        {
          label: "AI 理解",
          requirementLevel: "bonus",
          evidenceLevel: "partial",
          evidenceSummary: "具备机器学习基础和大模型业务接触。",
          nextStep: "复习数据质量对模型效果的影响。",
        },
      ],
    },
    evidenceMatrix: [
      {
        requirement: "数据分析与效果评估",
        resumeEvidence: ["使用 SQL / Python 处理实验数据"],
        state: "direct",
        assessment: "存在直接证据，但需要补充指标和结果。",
        action: "准备一段带指标的分析案例。",
      },
      {
        requirement: "跨团队推进",
        resumeEvidence: ["提出 2 项进入迭代排期的建议"],
        state: "direct",
        assessment: "能够体现推动结果。",
        action: "讲清沟通对象、阻力和个人贡献。",
      },
      {
        requirement: "AI 数据产品理解",
        resumeEvidence: ["大模型算法实习与推荐系统实验"],
        state: "transferable",
        assessment: "技术背景可迁移，产品方法仍需显性表达。",
        action: "准备对数据生产、评测和反馈闭环的理解。",
      },
    ],
    knowledgeTopics: [
      {
        topic: "大模型评测",
        priority: "must",
        whyRelevant: "岗位直接涉及效果评估。",
        explanation: "需理解离线指标、人工评测和线上反馈的差异。",
        currentEvidence: "简历仅呈现功能验证。",
        targetLevel: "能够独立说明评测方案与取舍。",
        selfCheckQuestions: ["如何选择评测指标？", "如何处理主观题的一致性？"],
      },
      {
        topic: "数据质量",
        priority: "must",
        whyRelevant: "数据生产质量影响模型表现。",
        explanation: "需关注准确性、一致性、覆盖度与安全边界。",
        currentEvidence: "有数据整理经验。",
        targetLevel: "能够提出质量检查和抽样复核流程。",
        selfCheckQuestions: ["如何定义数据质量？", "发现偏差后如何定位来源？"],
      },
      {
        topic: "产品闭环",
        priority: "should",
        whyRelevant: "岗位需要推动迭代。",
        explanation: "从用户问题到方案、上线、指标和复盘形成闭环。",
        currentEvidence: "有需求拆解与复盘经历。",
        targetLevel: "能够用一个项目讲清完整闭环。",
        selfCheckQuestions: ["如何确定问题优先级？", "上线后看哪些指标？"],
      },
    ],
    deepDives: [
      {
        resumeItem: "百度大模型算法实习",
        whyRelevant: "最接近目标岗位场景。",
        personalContributionFocus: "数据梳理、问题定位与建议推进。",
        likelyFollowUps: ["你负责的边界是什么？", "建议为什么能进入排期？"],
        factsToConfirm: ["实际使用的指标", "协作团队与周期"],
      },
      {
        resumeItem: "课程推荐系统实验",
        whyRelevant: "可验证数据分析与产品判断。",
        personalContributionFocus: "实验设计、指标看板和优先级调整。",
        likelyFollowUps: ["如何验证效果？", "有哪些失败尝试？"],
        factsToConfirm: ["样本规模", "优秀评级依据"],
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
      mustPrepare: ["两分钟自我介绍", "百度实习项目深挖", "大模型评测基础"],
      shouldPrepare: ["数据质量框架", "跨团队冲突案例"],
      optional: ["近期体验过的 AI 数据产品"],
    },
    selfIntroduction:
      "面试官您好，我是姜禾，目前就读于北京邮电大学人工智能专业。我在百度实习期间参与大模型业务的数据整理、功能验证与效果复盘，并把用户反馈转化为可执行建议，其中两项进入后续排期。我希望把技术理解、数据分析和产品推进能力结合起来，继续深耕 AI 数据产品方向。",
    reverseQuestions: [
      "团队当前最重视的数据质量问题是什么？",
      "实习生会参与哪些完整项目环节？",
      "这个岗位前三个月的评价标准是什么？",
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
        "我在百度实习期间参与大模型业务的数据整理、功能验证和效果复盘，并将用户反馈转成迭代建议，其中两项进入排期。这个过程让我完整接触了数据收集、问题分析和推动改进的闭环。",
      skipped: false,
      updatedAt: "2026-08-20T10:00:00.000Z",
    },
    "q-2": {
      questionId: "q-2",
      content:
        "我希望把人工智能专业背景和真实用户问题连接起来。AI 数据产品既需要理解模型边界，也需要把数据和反馈转化为可执行方案，这与我的经历和长期兴趣一致。",
      skipped: false,
      updatedAt: "2026-08-20T10:05:00.000Z",
    },
    "q-3": {
      questionId: "q-3",
      content:
        "我会先按业务目标拆分准确性、帮助度、安全性和稳定性，再建立代表性样本集、清晰的人工评分标准和一致性校验，并结合线上反馈持续补充失败样本。",
      skipped: false,
      updatedAt: "2026-08-20T10:10:00.000Z",
    },
    "q-4": {
      questionId: "q-4",
      content:
        "我汇总用户反馈并抽样核对模型输出，定位到两个高频问题，随后用案例和影响范围与产品、算法沟通，最终两项建议进入迭代排期。",
      skipped: false,
      updatedAt: "2026-08-20T10:15:00.000Z",
    },
  } satisfies InterviewAnswers,
  feedback: {
    overallScore: 78,
    dimensions: { jobFit: 82, structure: 78, evidence: 75, star: 76 },
    strengths: [
      "能够把技术背景与 AI 数据产品岗位建立联系。",
      "回答覆盖数据、评测和协作三个核心方向。",
    ],
    improvements: [
      "项目回答应补充样本规模、指标变化和个人决策。",
      "部分结论仍偏概括，可增加事实证据。",
    ],
    questionReviews: [
      {
        questionId: "q-1",
        diagnosis: "主线清楚，但结果证据略少。",
        suggestion: "补充建议进入排期的判断依据。",
        improvedAnswer:
          "围绕百度实习中的数据整理、问题定位和两项迭代结果展开，并说明个人贡献。",
      },
      {
        questionId: "q-3",
        diagnosis: "评测框架完整，缺少具体示例。",
        suggestion: "增加一个指标冲突或人工一致性案例。",
        improvedAnswer:
          "先定义业务目标和指标，再通过分层抽样、双人标注与一致性复核建立可重复的评测流程。",
      },
    ],
    nextActions: [
      "补全两个项目的可验证数字。",
      "用三分钟重新练习模型评测方案。",
      "准备一个跨团队分歧案例。",
    ],
  } satisfies InterviewReport,
  currentQuestionIndex: 7,
  completedAt: "2026-08-20T10:30:00.000Z",
};
