import type { JsonValue, ResumeContent, SerializedResumeSection } from "@/lib/types";
import { normalizeResumeContent } from "@/lib/resume-content";
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
  logoSize: "medium" as const,
  lineSpacing: 1.5,
  margin: { top: 20, right: 24, bottom: 20, left: 24 },
  sectionSpacing: 16,
  avatarStyle: "oneInch" as const,
};

export function contentToJadeResume(rawContent: ResumeContent): Resume {
  const content = normalizeResumeContent(rawContent);
  const now = new Date();
  const resumeId = "local-main-resume";
  const internships = content.internships ?? [];
  const skills = content.skills ?? [];
  const customSections = content.customSections ?? [];
  const editor = content.editor ?? {};

  const generatedSections: ResumeSection[] = [
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
        logo: item.logo,
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
      text: content.selfReview,
    }),
  ];

  if (content.profile.summary) {
    generatedSections.splice(1, 0, section<SummaryContent>(resumeId, "summary", "个人简介", 1, {
      text: content.profile.summary,
    }));
    generatedSections.forEach((item, index) => { item.sortOrder = index; });
  }

  if (skills.length > 0) {
    generatedSections.push(
      section<SkillsContent>(resumeId, "skills", "技能特长", generatedSections.length, {
        categories: [{ id: generateId("skills"), name: "核心技能", skills }],
      }),
    );
  }

  customSections.forEach((item) => {
    generatedSections.push(
      section<CustomContent>(resumeId, "custom", item.title, generatedSections.length, {
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

  const savedSections = hydrateEditorSections(editor.sections, resumeId, now);
  const sections = savedSections ? mergeEditorSections(savedSections, generatedSections) : generatedSections;

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
      sections: serializeResumeSections(resume.sections),
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
        logo: item.logo,
        role: item.description,
        highlights: item.highlights,
      })) ?? [],
    skills: skills?.categories.flatMap((category) => category.skills) ?? [],
    awards: certifications?.items.map((item) => item.name).filter(Boolean) ?? [],
    customSections: customSections.map((section) => ({
      title: section.title,
      content: section.content.items.map(formatCustomItem).filter(Boolean).join("\n\n"),
    })).filter((item) => item.title && item.content),
    selfReview: selfEvaluation?.text ?? "",
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
    logo: item.logo,
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
    logo: item.logo,
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

function serializeResumeSections(sections: ResumeSection[]): SerializedResumeSection[] {
  return sections.map((item) => ({
    ...item,
    content: item.content as unknown as JsonValue,
    createdAt: toIsoString(item.createdAt),
    updatedAt: toIsoString(item.updatedAt),
  }));
}

function hydrateEditorSections(
  sections: SerializedResumeSection[] | undefined,
  resumeId: string,
  fallbackDate: Date,
): ResumeSection[] | null {
  if (!Array.isArray(sections)) return null;
  if (sections.length === 0) return [];

  const hydrated = sections
    .filter((item) => item && typeof item.type === "string" && item.content)
    .map((item, index) => ({
      ...item,
      id: item.id || generateId(item.type),
      resumeId,
      sortOrder: Number.isFinite(item.sortOrder) ? item.sortOrder : index,
      visible: item.visible !== false,
      content: item.content as unknown as ResumeSection["content"],
      createdAt: toDate(item.createdAt, fallbackDate),
      updatedAt: toDate(item.updatedAt, fallbackDate),
    }));

  return hydrated.length ? hydrated.sort((a, b) => a.sortOrder - b.sortOrder) : null;
}

function mergeEditorSections(savedSections: ResumeSection[], generatedSections: ResumeSection[]) {
  const generatedByType = new Map(generatedSections.map((item) => [item.type, item]));
  return savedSections.map((saved, index) => ({
    ...mergeEditorSection(saved, generatedByType.get(saved.type)),
    sortOrder: index,
  }));
}

function mergeEditorSection(saved: ResumeSection, generated?: ResumeSection): ResumeSection {
  if (!generated) return saved;

  switch (saved.type) {
    case "personal_info": {
      const previous = saved.content as PersonalInfoContent;
      const next = generated.content as PersonalInfoContent;
      return {
        ...saved,
        content: {
          ...previous,
          fullName: next.fullName,
          email: next.email,
          phone: next.phone,
          location: next.location,
        },
      };
    }
    case "education":
      return {
        ...saved,
        content: {
          ...(saved.content as EducationContent),
          items: mergeItems(
            (saved.content as EducationContent).items,
            (generated.content as EducationContent).items,
            (previous, next) => ({
              ...previous,
              institution: next.institution,
              degree: next.degree,
              field: next.field,
              startDate: next.startDate,
              endDate: next.endDate,
              highlights: next.highlights,
            }),
          ),
        },
      };
    case "work_experience":
    case "internship_experience":
      return {
        ...saved,
        content: {
          ...(saved.content as WorkExperienceContent),
          items: mergeItems(
            (saved.content as WorkExperienceContent).items,
            (generated.content as WorkExperienceContent).items,
            (previous, next) => ({
              ...previous,
              company: next.company,
              position: next.position,
              logo: previous.logo ?? next.logo,
              startDate: next.startDate,
              endDate: next.endDate,
              current: next.current,
              highlights: next.highlights,
            }),
          ),
        },
      };
    case "projects":
      return {
        ...saved,
        content: {
          ...(saved.content as ProjectsContent),
          items: mergeItems(
            (saved.content as ProjectsContent).items,
            (generated.content as ProjectsContent).items,
            (previous, next) => ({
              ...previous,
              name: next.name,
              logo: previous.logo ?? next.logo,
              description: next.description,
              highlights: next.highlights,
            }),
          ),
        },
      };
    case "certifications":
      return {
        ...saved,
        content: {
          ...(saved.content as CertificationsContent),
          items: mergeItems(
            (saved.content as CertificationsContent).items,
            (generated.content as CertificationsContent).items,
            (previous, next) => ({
              ...previous,
              name: next.name,
            }),
          ),
        },
      };
    case "skills": {
      const previous = saved.content as SkillsContent;
      const next = generated.content as SkillsContent;
      if (!next.categories.length) return saved;
      const [firstCategory, ...otherCategories] = previous.categories;
      return {
        ...saved,
        content: {
          ...previous,
          categories: [
            {
              ...(firstCategory ?? { id: generateId("skills"), name: "核心技能" }),
              skills: next.categories.flatMap((category) => category.skills),
            },
            ...otherCategories,
          ],
        },
      };
    }
    case "summary":
    case "self_evaluation":
      return {
        ...saved,
        content: {
          ...(saved.content as SummaryContent),
          text: (generated.content as SummaryContent).text,
        },
      };
    default:
      return saved;
  }
}

function mergeItems<T>(savedItems: T[] = [], generatedItems: T[] = [], merge: (previous: T, next: T) => T) {
  const length = Math.max(savedItems.length, generatedItems.length);
  return Array.from({ length }, (_, index) => {
    const previous = savedItems[index];
    const next = generatedItems[index];
    if (previous && next) return merge(previous, next);
    return previous ?? next;
  }).filter((item): item is T => Boolean(item));
}

function toIsoString(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function toDate(value: Date | string, fallback: Date) {
  if (value instanceof Date) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
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
