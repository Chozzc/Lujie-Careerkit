import type { ResumeContent } from "@/lib/types";
import { generateId } from "@/lib/utils";
import type {
  CertificationsContent,
  CustomContent,
  EducationContent,
  PersonalInfoContent,
  ProjectsContent,
  Resume,
  ResumeSection,
  SkillsContent,
  SummaryContent,
  WorkExperienceContent,
} from "@/types/resume";

const DEFAULT_RESUME_THEME = {
  primaryColor: "#1a1a2e",
  accentColor: "#e94560",
  fontFamily: "Inter",
  fontSize: "medium",
  lineSpacing: 1.5,
  margin: { top: 20, right: 24, bottom: 20, left: 24 },
  sectionSpacing: 16,
  avatarStyle: "oneInch" as const,
};

export function contentToJadeResume(content: ResumeContent): Resume {
  const now = new Date();
  const resumeId = "local-main-resume";
  const internships = content.internships ?? [];
  const skills = content.skills ?? [];
  const customSections = content.customSections ?? [];
  const editor = content.editor ?? {};
  const selfEvaluationText = [content.profile.summary, content.selfReview]
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n");

  const sections: ResumeSection[] = [
    section<PersonalInfoContent>(resumeId, "personal_info", "个人信息", 0, {
      fullName: content.basics.name,
      jobTitle: "",
      email: content.basics.email,
      phone: content.basics.phone,
      location: content.basics.city,
      website: content.basics.links[0] ?? "",
      github: content.basics.links.find((item) => item.toLowerCase().includes("github")) ?? "",
      customLinks: content.basics.links.slice(1).map((url, index) => ({ label: `链接 ${index + 1}`, url })),
    }),
    section<EducationContent>(resumeId, "education", "教育背景", 1, {
      items: content.education.map((item) => ({
        id: generateId("edu"),
        institution: item.school,
        degree: item.degree,
        field: item.major,
        startDate: item.start,
        endDate: item.end,
        highlights: item.highlights,
      })),
    }),
    section<WorkExperienceContent>(resumeId, "work_experience", "工作经历", 2, {
      items: content.experiences.map(toWorkExperienceItem("work")),
    }),
    section<WorkExperienceContent>(resumeId, "internship_experience", "实习经历", 3, {
      items: internships.map(toWorkExperienceItem("internship")),
    }),
    section<ProjectsContent>(resumeId, "projects", "项目经历", 4, {
      items: content.projects.map((item) => ({
        id: generateId("project"),
        name: item.name,
        description: item.role,
        technologies: [],
        highlights: item.highlights,
      })),
    }),
    section<CertificationsContent>(resumeId, "certifications", "资格证书", 5, {
      items: content.awards.map((award) => ({
        id: generateId("cert"),
        name: award,
        issuer: "",
        date: "",
      })),
    }),
    section<SummaryContent>(resumeId, "self_evaluation", "自我评价", 6, {
      text: selfEvaluationText,
    }),
  ];

  if (skills.length > 0) {
    sections.push(
      section<SkillsContent>(resumeId, "skills", "技能特长", sections.length, {
        categories: [{ id: generateId("skills"), name: "核心技能", skills }],
      }),
    );
  }

  customSections.forEach((item) => {
    sections.push(
      section<CustomContent>(resumeId, "custom", item.title, sections.length, {
        items: [
          {
            id: generateId("custom"),
            title: "",
            description: item.content,
          },
        ],
      }),
    );
  });

  return {
    id: resumeId,
    userId: "local-user",
    title: content.editor?.displayName?.trim() || (content.basics.name ? `${content.basics.name}的简历` : "未命名简历"),
    template: editor.template ?? "modern",
    language: "zh",
    isDefault: true,
    createdAt: now,
    updatedAt: now,
    themeConfig: mergeResumeTheme(editor.themeConfig),
    sections,
  };
}

export function jadeResumeToContent(resume: Resume): ResumeContent {
  const personalInfo = getSection<PersonalInfoContent>(resume, "personal_info");
  const summary = getSection<SummaryContent>(resume, "summary");
  const work = getSection<WorkExperienceContent>(resume, "work_experience");
  const internship = getSection<WorkExperienceContent>(resume, "internship_experience");
  const education = getSection<EducationContent>(resume, "education");
  const skills = getSection<SkillsContent>(resume, "skills");
  const projects = getSection<ProjectsContent>(resume, "projects");
  const certifications = getSection<CertificationsContent>(resume, "certifications");
  const selfEvaluation = getSection<SummaryContent>(resume, "self_evaluation");
  const customSections = getSections<CustomContent>(resume, "custom");

  const links = [
    personalInfo?.website,
    personalInfo?.github,
    personalInfo?.linkedin,
    ...(personalInfo?.customLinks?.map((item) => item.url) ?? []),
  ].filter(Boolean) as string[];

  return {
    editor: {
      displayName: resume.title,
      template: resume.template,
      themeConfig: resume.themeConfig,
    },
    basics: {
      name: personalInfo?.fullName ?? "",
      email: personalInfo?.email ?? "",
      phone: personalInfo?.phone ?? "",
      city: personalInfo?.location ?? "",
      links,
    },
    profile: {
      title: "",
      summary: summary?.text ?? "",
    },
    education:
      education?.items.map((item) => ({
        school: item.institution,
        degree: item.degree,
        major: item.field,
        start: item.startDate,
        end: item.endDate,
        highlights: item.highlights,
      })) ?? [],
    experiences: work?.items.map(fromWorkExperienceItem) ?? [],
    internships: internship?.items.map(fromWorkExperienceItem) ?? [],
    projects:
      projects?.items.map((item) => ({
        name: item.name,
        role: item.description,
        highlights: item.highlights,
      })) ?? [],
    skills: skills?.categories.flatMap((category) => category.skills) ?? [],
    awards: certifications?.items.map((item) => item.name).filter(Boolean) ?? [],
    customSections: customSections.map((section) => ({
      title: section.title,
      content: section.content.items.map(formatCustomItem).filter(Boolean).join("\n\n"),
    })).filter((item) => item.title && item.content),
    selfReview: selfEvaluation?.text ?? customSections[0]?.content.items[0]?.description ?? "",
  };
}

function mergeResumeTheme(patch?: NonNullable<ResumeContent["editor"]>["themeConfig"]) {
  const theme = patch ?? {};
  return {
    ...DEFAULT_RESUME_THEME,
    ...theme,
    margin: {
      ...DEFAULT_RESUME_THEME.margin,
      ...(theme.margin ?? {}),
    },
  };
}

function toWorkExperienceItem(prefix: string) {
  return (item: ResumeContent["experiences"][number]) => ({
    id: generateId(prefix),
    company: item.company,
    position: item.role,
    location: "",
    startDate: item.start,
    endDate: item.end === "至今" ? null : item.end,
    current: item.end === "至今",
    description: "",
    technologies: [],
    highlights: item.highlights,
  });
}

function fromWorkExperienceItem(item: WorkExperienceContent["items"][number]) {
  return {
    company: item.company,
    role: item.position,
    start: item.startDate,
    end: item.current ? "至今" : item.endDate ?? "",
    highlights: item.highlights,
  };
}

function section<T>(resumeId: string, type: string, title: string, sortOrder: number, content: T): ResumeSection {
  const now = new Date();
  return {
    id: generateId(type),
    resumeId,
    type,
    title,
    sortOrder,
    visible: true,
    content: content as ResumeSection["content"],
    createdAt: now,
    updatedAt: now,
  };
}

function getSection<T>(resume: Resume, type: string): T | null {
  return (resume.sections.find((item) => item.type === type)?.content as T | undefined) ?? null;
}

function getSections<T>(resume: Resume, type: string): Array<ResumeSection & { content: T }> {
  return resume.sections.filter((item) => item.type === type) as Array<ResumeSection & { content: T }>;
}

function formatCustomItem(item: CustomContent["items"][number]) {
  return [item.title, item.subtitle, item.date, item.description].filter(Boolean).join("\n");
}
