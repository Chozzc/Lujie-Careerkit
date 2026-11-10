import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildAiResumeSnapshot } from "@/lib/ai/resume-snapshot";
import { TEMPLATES } from "@/lib/constants";
import { contentToJadeResume, jadeResumeToContent } from "@/lib/resume-adapter";
import { getInlineLayoutFields, getResumeBoldFields, supportsInlineLayout } from "@/lib/resume-inline-layout";
import { DEFAULT_RESUME_THEME } from "@/lib/resume-theme";
import { sampleResumeVersions } from "@/lib/sample-data";
import type { CertificationsContent, EducationContent, ProjectsContent, Resume, WorkExperienceContent } from "@/types/resume";

import { ResumePreview } from "./resume-preview";

const resume: Resume = {
  id: "resume",
  userId: "user",
  title: "Test resume",
  template: "classic",
  themeConfig: DEFAULT_RESUME_THEME,
  isDefault: true,
  language: "zh-CN",
  sections: [],
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

describe("ResumePreview", () => {
  it.each(["standalone", "paged", "export"] as const)("keeps %s rendering independent of remote font resources", (mode) => {
    const markup = renderToStaticMarkup(<ResumePreview resume={resume} mode={mode} />);

    expect(markup).not.toContain("<link");
    expect(markup).not.toContain("@font-face");
    expect(markup).toContain(`data-resume-render-mode="${mode}"`);
  });

  it("renders saved compact sections and all entry logos in every template", () => {
    const source = sampleResumeVersions.find((version) => version.id === "rv-baidu-ai-original")!.content;
    const original = contentToJadeResume({ ...source, awards: ["优秀学生干部", "校级一等奖学金"] });
    const work = original.sections.find((section) => section.type === "work_experience")!.content as WorkExperienceContent;
    const internship = original.sections.find((section) => section.type === "internship_experience")!.content as WorkExperienceContent;
    const projects = original.sections.find((section) => section.type === "projects")!.content as ProjectsContent;
    work.items[0].logo = "icon:building";
    internship.items[0].logo = "icon:briefcase";
    projects.items[0].logo = "icon:code";
    const beforeLayout = buildAiResumeSnapshot(jadeResumeToContent(original));
    for (const section of original.sections) {
      if (section.type === "education") {
        expect(getResumeBoldFields(section)).toEqual(["degree"]);
        section.content.inlineLayout = true;
        section.content.inlineBoldFields = ["field", "gpa", "highlights"];
      }
      if (["certifications", "work_experience", "internship_experience"].includes(section.type)) {
        section.content.inlineLayout = true;
      }
    }

    const persisted = JSON.parse(JSON.stringify(jadeResumeToContent(original)));
    const reopened = contentToJadeResume(persisted);
    expect(buildAiResumeSnapshot(persisted)).toEqual(beforeLayout);
    expect(getInlineLayoutFields(reopened.sections.find((section) => section.type === "education")!))
      .toEqual(["institution", "degree", "field", "gpa", "date", "highlights"]);
    const academic = { ...reopened, template: "academic" };
    const compact = renderToStaticMarkup(<ResumePreview resume={academic} />);
    academic.sections.find((section) => section.type === "education")!.content.inlineLayout = false;
    const defaultLayout = renderToStaticMarkup(<ResumePreview resume={academic} />);
    const originalDate = defaultLayout.match(/<span[^>]*>2023 – 2027<\/span>/)?.[0];
    expect(originalDate).toBeTruthy();
    expect(compact).toContain(originalDate);
    expect(defaultLayout).toContain("<b>人工智能</b>");
    expect(defaultLayout).not.toContain("<b>本科</b>");
    expect(defaultLayout).toContain('data-resume-field-bold="true"');
    expect(defaultLayout).not.toContain('data-education-gpa-inline="true"');
    academic.sections.find((section) => section.type === "education")!.content.inlineLayout = true;
    for (const template of TEMPLATES) {
      const markup = renderToStaticMarkup(<ResumePreview resume={{ ...reopened, template }} mode="export" />);
      expect(markup.match(/data-entry-logo="true"/g), template).toHaveLength(3);
      expect(markup, template).toContain("<b>人工智能</b>");
      expect(markup, template).toContain('data-resume-field-bold="true"');
      expect(markup, template).toContain('data-resume-compact-list="true"');
      const education = reopened.sections.find((section) => section.type === "education")!;
      education.content.inlineLayout = false;
      const originalMarkup = renderToStaticMarkup(<ResumePreview resume={{ ...reopened, template }} mode="export" />);
      education.content.inlineLayout = true;
      const gpaStyle = originalMarkup.match(/<p([^>]+)><span><b>GPA: 3\.8\/4\.0<\/b>/)?.[1];
      expect(gpaStyle, template).toBeTruthy();
      expect(markup, template).toContain('<span' + gpaStyle + ' data-education-gpa-inline="true"><b>GPA: 3.8/4.0</b>');
      expect(markup.match(/GPA: 3\.8\/4\.0/g), template).toHaveLength(1);
      expect(markup, template).toMatch(/人工智能<\/b>[\s\S]{0,450} - [\s\S]{0,250}北京邮电大学/);
    }
  });

  it("omits separators and inferred dates for incomplete education entries", () => {
    const source = sampleResumeVersions.find((version) => version.id === "rv-baidu-ai-original")!.content;
    const draft = contentToJadeResume(source);
    const education = draft.sections.find((section) => section.type === "education")!;
    const item = (education.content as EducationContent).items[0];
    Object.assign(item, { degree: "", field: "", startDate: "", endDate: "" });
    education.content.inlineLayout = true;
    for (const template of TEMPLATES) {
      const markup = renderToStaticMarkup(<ResumePreview resume={{ ...draft, template, sections: [education] }} />);
      expect(markup, template).not.toMatch(/至今|Present| - <span data-education-regular="true">北京邮电大学/);
      expect(markup, template).toContain("北京邮电大学");
    }
    item.endDate = "2027-06";
    const endOnly = renderToStaticMarkup(<ResumePreview resume={{ ...draft, template: "academic", sections: [education] }} />);
    expect(endOnly).toContain(">2027-06</span>");
  });

  it("limits layout controls and renders independent certificate emphasis in every template", () => {
    const draft = contentToJadeResume({ ...sampleResumeVersions[0].content, awards: ["示例证书", "另一张证书"] });
    const certificates = draft.sections.find((section) => section.type === "certifications")!;
    expect(draft.sections.filter((section) => supportsInlineLayout(section.type)).map((section) => section.type).sort())
      .toEqual(["certifications", "education"]);
    expect(getInlineLayoutFields(certificates)).toEqual(["name", "issuer", "date"]);
    expect(getResumeBoldFields(certificates)).toEqual(["name"]);
    Object.assign((certificates.content as CertificationsContent).items[0], { issuer: "示例机构", date: "2026-06" });
    certificates.content.inlineBoldFields = ["issuer", "date"];
    for (const template of TEMPLATES) {
      const preview = <ResumePreview resume={{ ...draft, template, sections: [certificates] }} />;
      certificates.content.inlineLayout = false;
      expect(renderToStaticMarkup(preview), template).not.toContain('data-resume-compact-list="true"');
      certificates.content.inlineLayout = true;
      const markup = renderToStaticMarkup(preview);
      expect(markup, template).toContain('data-resume-compact-list="true"');
      expect(markup, template).toContain("另一张证书");
      expect(markup, template).toContain('data-education-regular="true">示例证书</span>');
      expect(markup, template).toContain("<b>示例机构</b>");
      expect(markup, template).toMatch(/<b>[^<]*2026-06[^<]*<\/b>/);
    }
  });

  it("removes academic self-evaluation indentation while keeping it on the introduction", () => {
    const sectionBase = { resumeId: resume.id, visible: true, createdAt: resume.createdAt, updatedAt: resume.updatedAt };
    const sections: Resume["sections"] = [
      { ...sectionBase, id: "intro", type: "summary", title: "个人简介", sortOrder: 0, content: { text: "简介正文" } },
      { ...sectionBase, id: "evaluation", type: "self_evaluation", title: "自我评价", sortOrder: 1, content: { text: "　　评价正文" } },
    ];
    const markup = renderToStaticMarkup(<ResumePreview resume={{ ...resume, template: "academic", sections }} />);
    expect(markup.match(/<p[^>]+>简介正文<\/p>/)?.[0]).toContain("indent-8");
    const evaluation = markup.match(/<p[^>]+>评价正文<\/p>/)?.[0];
    expect(evaluation).toBeDefined();
    expect(evaluation).not.toContain("indent-8");
  });
});
