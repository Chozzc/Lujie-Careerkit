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
      highlights: ["GPA 3.8/4.0", "核心课程：数据结构、数据库、机器学习、软件工程"],
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

export const sampleJobs: JobRecord[] = [
  {
    id: "cmqgzt65k0003a0cwskeetbo1",
    company: "网易",
    title: "后端开发",
    source: "实习僧",
    deadline: null,
    jd: "网易 后端开发，暂未补充完整 JD。",
  },
  {
    id: "cmqgua8t70000a0cwl8o3xqwn",
    company: "百度",
    title: "前端开发实习生",
    source: "BOSS直聘",
    deadline: null,
    jd: "百度 前端开发实习生，暂未补充完整 JD。",
  },
  {
    id: "cmq1p2ksn0006ui8wbyrbxega",
    company: "华为",
    title: "ai测试实习生",
    source: "猎聘",
    deadline: null,
    jd: "华为 ai测试实习生，暂未补充完整 JD。",
  },
  {
    id: "cmq1p21td0003ui8wzce4qda6",
    company: "阿里巴巴",
    title: "千问大模型开发实习生",
    source: "企业官网",
    deadline: null,
    jd: "阿里巴巴 千问大模型开发实习生，暂未补充完整 JD。",
  },
  {
    id: "cmq1ox0mq0000ui8wt80spiuh",
    company: "小红书",
    title: "agent运营实习生",
    source: "内推",
    deadline: null,
    jd: "小红书 agent运营实习生，暂未补充完整 JD。",
  },
  {
    id: "job-meituan-backend",
    company: "美团",
    title: "后端开发实习生",
    source: "智联招聘",
    deadline: "2026-06-10",
    jd: "参与到店业务服务开发，要求 Java、Spring、SQL，了解高并发和接口设计。",
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
    stageDate: "2026-06-24",
    priority: "NORMAL",
    nextFollowUpAt: null,
    notes: "已加入投递跟进。",
  },
  {
    id: "cmqgua8tg0002a0cwscbuxxq1",
    jobId: "cmqgua8t70000a0cwl8o3xqwn",
    status: "ASSESSMENT",
    resumeVersionId: null,
    appliedAt: "2026-06-16",
    stageDate: null,
    priority: "NORMAL",
    nextFollowUpAt: null,
    notes: "已加入投递跟进。",
  },
  {
    id: "cmq1p2ksw0008ui8wf2yh55ri",
    jobId: "cmq1p2ksn0006ui8wbyrbxega",
    status: "REJECTED",
    resumeVersionId: null,
    appliedAt: "2026-06-16",
    stageDate: null,
    priority: "NORMAL",
    nextFollowUpAt: null,
    notes: "已加入投递跟进。",
  },
  {
    id: "cmq1p21tm0005ui8w3u1taqyh",
    jobId: "cmq1p21td0003ui8wzce4qda6",
    status: "OFFER",
    resumeVersionId: null,
    appliedAt: null,
    stageDate: null,
    priority: "NORMAL",
    nextFollowUpAt: null,
    notes: "新岗位，等待匹配优化。",
  },
  {
    id: "cmq1ox0n40002ui8w0au2hlxb",
    jobId: "cmq1ox0mq0000ui8wt80spiuh",
    status: "APPLIED",
    resumeVersionId: null,
    appliedAt: "2026-06-17",
    stageDate: "2026-06-24",
    priority: "NORMAL",
    nextFollowUpAt: null,
    notes: "已加入投递跟进。",
  },
  {
    id: "app-meituan-backend",
    jobId: "job-meituan-backend",
    status: "ARCHIVED",
    resumeVersionId: null,
    appliedAt: "2026-06-09",
    stageDate: "2026-06-27",
    priority: "NORMAL",
    nextFollowUpAt: "2026-06-02",
    notes: "官网投递，待跟进。",
  },
];
