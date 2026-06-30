import type { JobAnalysis } from "./types";

const KNOWN_KEYWORDS = [
  "JavaScript",
  "TypeScript",
  "React",
  "Next.js",
  "Vue",
  "Java",
  "Spring",
  "SQL",
  "Python",
  "机器学习",
  "推荐系统",
  "数据分析",
  "用户研究",
  "A/B 测试",
  "工程化",
  "性能优化",
  "浏览器渲染",
  "网络请求",
];

export function analyzeJobInput(input: string): JobAnalysis {
  const text = input.trim();

  if (!text) {
    return {
      company: "待填写公司",
      title: "待分析岗位",
      deadline: null,
      requirements: [],
      keywords: [],
      bonusPoints: [],
      risks: ["缺少岗位 JD，无法判断关键词和匹配缺口。"],
      suggestions: ["先粘贴岗位 JD 或补充岗位职责，再进行匹配优化。"],
    };
  }

  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  const [companyCandidate, titleCandidate] = (firstLine ?? "").split(/\s*[-—|｜]\s*/);
  const deadlineMatch = text.match(/(?:截止|投递截止|ddl|DDL)[:：]?\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
  const keywords = KNOWN_KEYWORDS.filter((keyword) =>
    text.toLocaleLowerCase().includes(keyword.toLocaleLowerCase()),
  );
  const requirementLine = extractSection(text, ["任职要求", "要求", "岗位要求"]);
  const bonusLine = extractSection(text, ["加分项", "优先", "加分"]);

  return {
    company: companyCandidate || "待填写公司",
    title: titleCandidate || "待分析岗位",
    deadline: deadlineMatch?.[1]?.replaceAll("/", "-") ?? null,
    requirements: splitMeaningful(requirementLine || text).slice(0, 5),
    keywords,
    bonusPoints: splitMeaningful(bonusLine).slice(0, 4),
    risks: keywords.length < 3 ? ["关键词信息偏少，建议补充完整 JD 后再生成优化后简历。"] : [],
    suggestions: buildSuggestions(keywords),
  };
}

function extractSection(text: string, labels: string[]) {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const line = lines.find((candidate) => labels.some((label) => candidate.includes(label)));
  return line ?? "";
}

function splitMeaningful(text: string) {
  return text
    .split(/[。；;\n]/)
    .map((item) => item.replace(/^(任职要求|岗位要求|要求|加分项|优先)[:：]/, "").trim())
    .filter((item) => item.length > 0);
}

function buildSuggestions(keywords: string[]) {
  if (keywords.length === 0) {
    return ["先补充岗位关键词，再决定简历里哪些项目需要前置。"];
  }

  return [
    `把 ${keywords.slice(0, 3).join("、")} 相关经历放到项目或技能区前半部分。`,
    "将职责描述改成“动作 + 方法 + 结果”的表达，避免只罗列技术名词。",
  ];
}
