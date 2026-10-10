import type { InterviewPreparation } from "@/lib/interview-preparation";

export type InterviewPreparationExportLabels = {
  documentTitle: string;
  basedOn: string;
  roleFamily: string;
  assumptions: string;
  sections: {
    overview: string;
    capability: string;
    evidence: string;
    knowledge: string;
    deepDives: string;
    questions: string;
    plan: string;
  };
  requirementLevel: string;
  evidenceLevel: string;
  nextStep: string;
  resumeEvidence: string;
  action: string;
  explanation: string;
  currentEvidence: string;
  targetLevel: string;
  selfCheck: string;
  contribution: string;
  followUps: string;
  factsToConfirm: string;
  category: string;
  preparationDirection: string;
  introduction: string;
  reverseQuestions: string;
  stateLabels: Record<InterviewPreparation["evidenceMatrix"][number]["state"], string>;
  priorityLabels: Record<InterviewPreparation["targetedQuestions"][number]["priority"], string>;
  requirementLabels: Record<InterviewPreparation["capabilityProfile"]["dimensions"][number]["requirementLevel"], string>;
  evidenceLabels: Record<InterviewPreparation["capabilityProfile"]["dimensions"][number]["evidenceLevel"], string>;
};

export function buildInterviewPreparationFileName(preparation: InterviewPreparation, suffix = "面试准备资料") {
  const name = `${preparation.meta.company}-${preparation.meta.title}-${suffix}`
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s*-+\s*/g, "-")
    .trim();
  return (name || "面试准备资料").slice(0, 100);
}

export async function exportInterviewPreparationDocx(
  preparation: InterviewPreparation,
  labels: InterviewPreparationExportLabels,
) {
  const { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } = await import("docx");
  const children: Array<InstanceType<typeof Paragraph>> = [];
  const paragraph = (text: string, options?: { bold?: boolean; bullet?: boolean }) =>
    new Paragraph({
      bullet: options?.bullet ? { level: 0 } : undefined,
      spacing: { after: 100, line: 320 },
      children: [new TextRun({ text, bold: options?.bold, size: 22 })],
    });
  const heading = (text: string, level: typeof HeadingLevel.HEADING_1 | typeof HeadingLevel.HEADING_2) =>
    new Paragraph({
      heading: level,
      spacing: { before: level === HeadingLevel.HEADING_1 ? 260 : 160, after: 120 },
      children: [new TextRun({ text, bold: true, color: "244A73" })],
    });
  const labeled = (label: string, value: string) => paragraph(`${label}：${value}`);
  const bullets = (items: string[]) => items.forEach((item) => children.push(paragraph(item, { bullet: true })));

  children.push(new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text: `${preparation.meta.company} · ${preparation.meta.title}`, bold: true, size: 34, color: "244A73" })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 260 },
    children: [new TextRun({ text: `${labels.documentTitle} · ${labels.basedOn}`, color: "64748B", size: 20 })],
  }));

  children.push(heading(labels.sections.overview, HeadingLevel.HEADING_1));
  children.push(labeled(labels.roleFamily, preparation.meta.roleFamily), paragraph(preparation.meta.roleSummary));
  if (preparation.meta.assumptions.length) {
    children.push(heading(labels.assumptions, HeadingLevel.HEADING_2));
    bullets(preparation.meta.assumptions);
  }

  children.push(heading(labels.sections.capability, HeadingLevel.HEADING_1), paragraph(preparation.capabilityProfile.overview));
  preparation.capabilityProfile.dimensions.forEach((item) => {
    children.push(heading(item.label, HeadingLevel.HEADING_2));
    children.push(
      labeled(labels.requirementLevel, labels.requirementLabels[item.requirementLevel]),
      labeled(labels.evidenceLevel, labels.evidenceLabels[item.evidenceLevel]),
      paragraph(item.evidenceSummary),
      labeled(labels.nextStep, item.nextStep),
    );
  });

  children.push(heading(labels.sections.evidence, HeadingLevel.HEADING_1));
  preparation.evidenceMatrix.forEach((item, index) => {
    children.push(heading(`${index + 1}. ${item.requirement} · ${labels.stateLabels[item.state]}`, HeadingLevel.HEADING_2));
    children.push(paragraph(item.assessment));
    if (item.resumeEvidence.length) {
      children.push(paragraph(`${labels.resumeEvidence}：`, { bold: true }));
      bullets(item.resumeEvidence);
    }
    children.push(labeled(labels.action, item.action));
  });

  children.push(heading(labels.sections.knowledge, HeadingLevel.HEADING_1));
  preparation.knowledgeTopics.forEach((item, index) => {
    children.push(heading(`${index + 1}. ${item.topic} · ${labels.priorityLabels[item.priority]}`, HeadingLevel.HEADING_2));
    children.push(
      paragraph(item.whyRelevant),
      labeled(labels.explanation, item.explanation),
      labeled(labels.currentEvidence, item.currentEvidence),
      labeled(labels.targetLevel, item.targetLevel),
      paragraph(`${labels.selfCheck}：`, { bold: true }),
    );
    bullets(item.selfCheckQuestions);
  });

  children.push(heading(labels.sections.deepDives, HeadingLevel.HEADING_1));
  preparation.deepDives.forEach((item, index) => {
    children.push(heading(`${index + 1}. ${item.resumeItem}`, HeadingLevel.HEADING_2));
    children.push(paragraph(item.whyRelevant), labeled(labels.contribution, item.personalContributionFocus));
    if (item.likelyFollowUps.length) {
      children.push(paragraph(`${labels.followUps}：`, { bold: true }));
      bullets(item.likelyFollowUps);
    }
    if (item.factsToConfirm.length) {
      children.push(paragraph(`${labels.factsToConfirm}：`, { bold: true }));
      bullets(item.factsToConfirm);
    }
  });

  children.push(heading(labels.sections.questions, HeadingLevel.HEADING_1));
  preparation.targetedQuestions.forEach((item, index) => {
    children.push(heading(`${index + 1}. ${item.question} · ${labels.priorityLabels[item.priority]}`, HeadingLevel.HEADING_2));
    children.push(labeled(labels.category, item.category), labeled(labels.preparationDirection, item.preparationDirection));
  });

  children.push(heading(labels.sections.plan, HeadingLevel.HEADING_1));
  (["must", "should", "optional"] as const).forEach((priority) => {
    const items = priority === "must"
      ? preparation.preparationPlan.mustPrepare
      : priority === "should"
        ? preparation.preparationPlan.shouldPrepare
        : preparation.preparationPlan.optional;
    if (!items.length) return;
    children.push(heading(labels.priorityLabels[priority], HeadingLevel.HEADING_2));
    bullets(items);
  });
  children.push(heading(labels.introduction, HeadingLevel.HEADING_2), paragraph(preparation.selfIntroduction));
  children.push(heading(labels.reverseQuestions, HeadingLevel.HEADING_2));
  bullets(preparation.reverseQuestions);

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Microsoft YaHei", size: 22, color: "334155" },
          paragraph: { spacing: { line: 320, after: 100 } },
        },
      },
    },
    sections: [{
      properties: { page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } } },
      children,
    }],
  });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${buildInterviewPreparationFileName(preparation, labels.documentTitle)}.docx`);
  return blob;
}

export function printInterviewPreparation(
  preparation: InterviewPreparation,
  labels: InterviewPreparationExportLabels,
) {
  // A same-origin frame works in browsers and desktop WebViews without a popup window.
  document.getElementById("interview-print-frame")?.remove();
  const frame = document.createElement("iframe");
  frame.id = "interview-print-frame";
  frame.title = labels.documentTitle;
  frame.tabIndex = -1;
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0";
  frame.addEventListener("load", () => {
    const printWindow = frame.contentWindow;
    if (!printWindow) { frame.remove(); return; }
    printWindow.addEventListener("afterprint", () => frame.remove(), { once: true });
    printWindow.focus();
    printWindow.print();
  }, { once: true });
  frame.srcdoc = buildInterviewPreparationPrintHtml(preparation, labels);
  document.body.appendChild(frame);
}

export function buildInterviewPreparationPrintHtml(
  preparation: InterviewPreparation,
  labels: InterviewPreparationExportLabels,
) {
  const e = escapeHtml;
  const list = (items: string[]) => items.length ? `<ul>${items.map((item) => `<li>${e(item)}</li>`).join("")}</ul>` : "";
  const field = (label: string, value: string) => `<p><strong>${e(label)}：</strong>${e(value)}</p>`;
  const section = (title: string, body: string) => `<section><h2>${e(title)}</h2>${body}</section>`;

  const overview = `<p class="lead">${e(preparation.meta.roleSummary)}</p>${field(labels.roleFamily, preparation.meta.roleFamily)}${
    preparation.meta.assumptions.length ? `<h3>${e(labels.assumptions)}</h3>${list(preparation.meta.assumptions)}` : ""
  }`;
  const capability = `<p class="lead">${e(preparation.capabilityProfile.overview)}</p>${preparation.capabilityProfile.dimensions.map((item) =>
    `<article><h3>${e(item.label)}</h3>${field(labels.requirementLevel, labels.requirementLabels[item.requirementLevel])}${field(labels.evidenceLevel, labels.evidenceLabels[item.evidenceLevel])}<p>${e(item.evidenceSummary)}</p>${field(labels.nextStep, item.nextStep)}</article>`
  ).join("")}`;
  const evidence = preparation.evidenceMatrix.map((item, index) =>
    `<article><h3>${index + 1}. ${e(item.requirement)} <span>${e(labels.stateLabels[item.state])}</span></h3><p>${e(item.assessment)}</p>${
      item.resumeEvidence.length ? `<h4>${e(labels.resumeEvidence)}</h4>${list(item.resumeEvidence)}` : ""
    }${field(labels.action, item.action)}</article>`
  ).join("");
  const knowledge = preparation.knowledgeTopics.map((item, index) =>
    `<article><h3>${index + 1}. ${e(item.topic)} <span>${e(labels.priorityLabels[item.priority])}</span></h3><p>${e(item.whyRelevant)}</p>${field(labels.explanation, item.explanation)}${field(labels.currentEvidence, item.currentEvidence)}${field(labels.targetLevel, item.targetLevel)}<h4>${e(labels.selfCheck)}</h4>${list(item.selfCheckQuestions)}</article>`
  ).join("");
  const deepDives = preparation.deepDives.map((item, index) =>
    `<article><h3>${index + 1}. ${e(item.resumeItem)}</h3><p>${e(item.whyRelevant)}</p>${field(labels.contribution, item.personalContributionFocus)}${
      item.likelyFollowUps.length ? `<h4>${e(labels.followUps)}</h4>${list(item.likelyFollowUps)}` : ""
    }${item.factsToConfirm.length ? `<h4>${e(labels.factsToConfirm)}</h4>${list(item.factsToConfirm)}` : ""}</article>`
  ).join("");
  const questions = preparation.targetedQuestions.map((item, index) =>
    `<article><h3>${index + 1}. ${e(item.question)} <span>${e(labels.priorityLabels[item.priority])}</span></h3>${field(labels.category, item.category)}${field(labels.preparationDirection, item.preparationDirection)}</article>`
  ).join("");
  const plan = ([
    [labels.priorityLabels.must, preparation.preparationPlan.mustPrepare],
    [labels.priorityLabels.should, preparation.preparationPlan.shouldPrepare],
    [labels.priorityLabels.optional, preparation.preparationPlan.optional],
  ] as const).map(([title, items]) => items.length ? `<h3>${e(title)}</h3>${list(items)}` : "").join("")
    + `<h3>${e(labels.introduction)}</h3><p class="pre">${e(preparation.selfIntroduction)}</p><h3>${e(labels.reverseQuestions)}</h3>${list(preparation.reverseQuestions)}`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${e(buildInterviewPreparationFileName(preparation, labels.documentTitle))}</title><style>
    @page{size:A4;margin:16mm 15mm}*{box-sizing:border-box}body{margin:0;color:#27364a;font:14px/1.75 "Microsoft YaHei","PingFang SC",Arial,sans-serif}
    header{padding:0 0 18px;border-bottom:2px solid #315f92}h1{margin:0;color:#173b63;font-size:25px}header p{margin:6px 0 0;color:#64748b}
    section{break-before:page;padding-top:2px}section:first-of-type{break-before:auto}h2{margin:18px 0 12px;color:#244a73;font-size:20px;border-bottom:1px solid #cbd5e1;padding-bottom:7px}
    h3{margin:15px 0 6px;color:#27364a;font-size:15px}h3 span{font-size:12px;color:#315f92}h4{margin:8px 0 3px}p{margin:5px 0}.lead{color:#475569}.pre{white-space:pre-wrap}
    article{break-inside:avoid;border-bottom:1px solid #e2e8f0;padding:2px 0 10px}ul{margin:4px 0 8px;padding-left:22px}li{margin:2px 0}
  </style></head><body><header><h1>${e(preparation.meta.company)} · ${e(preparation.meta.title)}</h1><p>${e(labels.documentTitle)} · ${e(labels.basedOn)}</p></header>
  ${section(labels.sections.overview, overview)}
  ${section(labels.sections.capability, capability)}
  ${section(labels.sections.evidence, evidence)}
  ${section(labels.sections.knowledge, knowledge)}
  ${section(labels.sections.deepDives, deepDives)}
  ${section(labels.sections.questions, questions)}
  ${section(labels.sections.plan, plan)}
  </body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]!);
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
