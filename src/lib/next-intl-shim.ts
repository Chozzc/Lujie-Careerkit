"use client";

const messages: Record<string, string> = {
  "editor.sections.personalInfo": "个人信息",
  "editor.sections.summary": "个人简介",
  "editor.sections.workExperience": "工作经历",
  "editor.sections.internshipExperience": "实习经历",
  "editor.sections.education": "教育背景",
  "editor.sections.skills": "技能特长",
  "editor.sections.projects": "项目经历",
  "editor.sections.certifications": "资格证书",
  "editor.sections.selfEvaluation": "自我评价",
  "editor.sections.languages": "语言能力",
  "editor.sections.github": "GitHub 项目",
  "editor.sections.qrCodes": "二维码",
  "editor.sections.custom": "自定义模块",
  "editor.sidebar.sections": "简历模块",
  "editor.sidebar.addSection": "添加模块",
  "editor.invalidSectionContent": "模块内容格式异常",
  "editor.aiPolish": "AI 优化",
  "editor.toolbar.preview": "预览",
  "editor.mobile.edit": "编辑",
  "editor.mobile.preview": "预览",
  "editor.fields.fullName": "姓名",
  "editor.fields.jobTitle": "目标岗位",
  "editor.fields.email": "邮箱",
  "editor.fields.phone": "电话",
  "editor.fields.location": "所在地",
  "editor.fields.website": "个人网站",
  "editor.fields.github": "GitHub",
  "editor.fields.linkedin": "LinkedIn",
  "editor.fields.wechat": "微信",
  "editor.fields.age": "年龄",
  "editor.fields.gender": "性别",
  "editor.fields.politicalStatus": "政治面貌",
  "editor.fields.ethnicity": "民族",
  "editor.fields.hometown": "籍贯",
  "editor.fields.maritalStatus": "婚姻状况",
  "editor.fields.yearsOfExperience": "工作年限",
  "editor.fields.educationLevel": "最高学历",
  "editor.fields.description": "描述",
  "editor.fields.company": "公司",
  "editor.fields.position": "职位",
  "editor.fields.startDate": "开始时间",
  "editor.fields.endDate": "结束时间",
  "editor.fields.highlights": "亮点",
  "editor.fields.technologies": "技术/关键词",
  "editor.fields.institution": "学校",
  "editor.fields.degree": "学历",
  "editor.fields.field": "专业",
  "editor.fields.gpa": "GPA",
  "editor.fields.skillCategory": "技能分类",
  "editor.fields.projectName": "项目名称",
  "editor.fields.certName": "证书名称",
  "editor.fields.issuer": "颁发机构",
  "editor.fields.certDate": "日期",
  "editor.fields.language": "语言",
  "editor.fields.proficiency": "熟练程度",
  "editor.fields.repoUrl": "仓库地址",
  "editor.fields.repoName": "仓库名",
  "editor.fields.stars": "Stars",
  "editor.fields.qrAutoGenerate": "自动识别链接",
  "editor.fields.qrLabel": "标签",
  "editor.fields.qrUrl": "链接",
  "editor.fields.qrUrlInvalid": "链接格式不正确",
  "editor.fields.addItem": "添加一项",
  "themeEditor.avatar.circle": "圆形",
  "themeEditor.avatar.oneInch": "1 寸照",
};

export function useTranslations(namespace?: string) {
  return (key?: string, values?: Record<string, string | number>) => {
    if (!key) return namespace ?? "";
    const fullKey = namespace ? `${namespace}.${key}` : key;
    const template = messages[fullKey] ?? messages[key] ?? fallbackMessage(key, values);
    if (!values) return template;
    return Object.entries(values).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      template,
    );
  };
}

function fallbackMessage(key: string, values?: Record<string, string | number>) {
  if (key === "dateDisplay" && values?.year && values?.month) return "{year}-{month}";
  if (key.startsWith("months.")) return key.split(".").at(-1) ?? key;
  return prettifyKey(key);
}

function prettifyKey(key: string) {
  const last = key.split(".").at(-1) ?? key;
  return last.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}
