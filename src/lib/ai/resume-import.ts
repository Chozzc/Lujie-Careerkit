import { parseAiJsonResponse } from "./tasks";
import type { EffectiveAiSettings } from "./settings";
import { coerceResumeContent, normalizeResumeContent } from "../resume-content";
import type { ResumeContent } from "../types";

const QWEN_DOC_MODEL = "qwen-doc-turbo";

type QwenFileUploadResponse = {
  id?: string;
  error?: { message?: string };
};

type QwenChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

export async function parseResumeWithQwenDoc(input: {
  file: File;
  settings: EffectiveAiSettings;
}): Promise<ResumeContent> {
  if (input.settings.providerId !== "qwen") {
    throw new Error("当前 AI Provider 不是阿里百炼 / Qwen。");
  }
  if (!input.settings.enabled || !input.settings.apiKey) {
    throw new Error("请先在设置中保存阿里百炼 API Key，并启用 AI。");
  }

  const fileId = await uploadQwenFile(input.file, input.settings);
  try {
    const content = await extractResumeJson(fileId, input.file.name, input.settings);
    return normalizeResumeContent(content, input.file.name.replace(/\.[^.]+$/, ""));
  } finally {
    void deleteQwenFile(fileId, input.settings);
  }
}

async function uploadQwenFile(file: File, settings: EffectiveAiSettings) {
  const formData = new FormData();
  formData.set("purpose", "file-extract");
  formData.set("file", file, file.name);

  const response = await fetch(`${settings.baseUrl}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${settings.apiKey}` },
    body: formData,
  });
  const payload = (await response.json().catch(() => null)) as QwenFileUploadResponse | null;
  if (!response.ok || !payload?.id) {
    throw new Error(payload?.error?.message || `百炼文件上传失败：HTTP ${response.status}`);
  }
  return payload.id;
}

async function extractResumeJson(fileId: string, fileName: string, settings: EffectiveAiSettings) {
  const response = await fetch(`${settings.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: QWEN_DOC_MODEL,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            "你是简历信息抽取助手，不是简历优化助手。只做结构识别和字段归类，保留原文语义、原句和顺序，不要润色、压缩、改写、重排或补写内容；只提取正文，不提取版式符号。只输出一个合法 JSON 对象，不要 Markdown，不要解释。",
        },
        {
          role: "system",
          content: `fileid://${fileId}`,
        },
        {
          role: "user",
          content: buildResumeImportPrompt(fileName),
        },
      ],
    }),
  });
  const payload = (await response.json().catch(() => null)) as QwenChatResponse | null;
  const text = payload?.choices?.[0]?.message?.content ?? "";
  if (!response.ok || !text) {
    throw new Error(payload?.error?.message || `Qwen-Doc-Turbo 解析失败：HTTP ${response.status}`);
  }
  return coerceResumeContent(parseAiJsonResponse(text), fileName.replace(/\.[^.]+$/, ""));
}

async function deleteQwenFile(fileId: string, settings: EffectiveAiSettings) {
  await fetch(`${settings.baseUrl}/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${settings.apiKey}` },
  }).catch(() => undefined);
}

function buildResumeImportPrompt(fileName: string) {
  return [
    `请解析文件「${fileName}」，把它转换成录阶 ResumeContent JSON。`,
    "重要：这是“导入并还原简历”，不是“优化简历”。请保留用户原句、原有小标题和原顺序；不要把项目符号、列表编号、装饰线、页眉页脚、页码等版式元素当作正文。",
    "",
    "字段要求：",
    "- basics.name/email/phone/city/links：候选人的基础信息，没有就填空字符串或空数组。电话和邮箱必须分开，email 只能是邮箱地址，phone 只能是电话号码；不要把手机号拼到 QQ 邮箱前面。",
    "- profile.title：求职意向或目标岗位，没有就填空字符串。",
    "- profile.summary：只有原简历明确写了个人总结/自我评价/求职概述时才填写，并保留原文。",
    "- education：教育背景。school/degree/major/start/end/highlights 必须存在。",
    "- experiences：正式工作经历。company/role/start/end/highlights 必须存在。",
    "- internships：实习经历。company/role/start/end/highlights 必须存在。",
    "- projects：项目经历。name/role/highlights 必须存在。highlights 必须保留原简历 bullet 后面的正文和原顺序，不要合并、删减、润色或重新排序。",
    "- skills：仅放“技能/专业技能/技术栈”等明确技能栏中的短关键词数组；不要把“主要优势与技能认证”“个人优势”“作品说明”等用户自定义标题整段拆进 skills。",
    "- awards：证书、奖项、荣誉数组。",
    "- customSections：用户自定义标题模块。凡是标题不能稳定映射到 education/experiences/internships/projects/skills/awards/profile 的，都放这里，title 保留原标题，content 保留该标题下的原文。",
    "- selfReview：自我评价或补充说明。",
    "",
    "分类规则：",
    "- 实习经历不要放进 experiences，放进 internships。",
    "- 项目经历不要放进工作经历，放进 projects。",
    "- 用户已经写好的小标题和 bullet 顺序必须保留，不要为了看起来更像模板而拆散。",
    "- 时间保留原文格式，例如 2022.09、2024-06、至今。",
    "- 所有字段都必须来自文件内容；无法确认的信息不要猜。",
    "- 如果原文是“从0到1产品架构设计/模型落地与迭代/跨团队协作/取得成果”这样的项目内小标题，保留这些小标题和其后的原文，不要改成新的短句。",
    "",
    "只返回 JSON，结构必须完全符合这个形状：",
    JSON.stringify({
      basics: { name: "", email: "", phone: "", city: "", links: [] },
      profile: { title: "", summary: "" },
      education: [{ school: "", degree: "", major: "", start: "", end: "", highlights: [] }],
      experiences: [{ company: "", role: "", start: "", end: "", highlights: [] }],
      internships: [{ company: "", role: "", start: "", end: "", highlights: [] }],
      projects: [{ name: "", role: "", highlights: [] }],
      skills: [],
      awards: [],
      customSections: [{ title: "", content: "" }],
      selfReview: "",
    }, null, 2),
  ].join("\n");
}
