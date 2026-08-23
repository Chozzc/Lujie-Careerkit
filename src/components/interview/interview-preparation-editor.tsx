"use client";

import type { InterviewPreparation } from "@/lib/interview-preparation";
import { useTranslations } from "next-intl";

export function InterviewPreparationEditor({
  value,
  onChange,
}: {
  value: InterviewPreparation;
  onChange: (value: InterviewPreparation) => void;
}) {
  const t = useTranslations("careerLibrary.preparationEditor");
  const setMeta = (patch: Partial<InterviewPreparation["meta"]>) => onChange({ ...value, meta: { ...value.meta, ...patch } });
  return (
    <div className="space-y-6">
      <EditorSection title={t("overview")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("company")} value={value.meta.company} onChange={(company) => setMeta({ company })} />
          <TextField label={t("role")} value={value.meta.title} onChange={(title) => setMeta({ title })} />
          <TextField label={t("roleFamily")} value={value.meta.roleFamily} onChange={(roleFamily) => setMeta({ roleFamily })} />
        </div>
        <TextField label={t("roleSummary")} value={value.meta.roleSummary} multiline onChange={(roleSummary) => setMeta({ roleSummary })} />
        <LinesField label={t("assumptions")} suffix={t("perLine")} value={value.meta.assumptions} onChange={(assumptions) => setMeta({ assumptions })} />
      </EditorSection>

      <EditorSection title={t("capability")}>
        <TextField
          label={t("capabilityOverview")}
          value={value.capabilityProfile.overview}
          multiline
          onChange={(overview) => onChange({ ...value, capabilityProfile: { ...value.capabilityProfile, overview } })}
        />
        {value.capabilityProfile.dimensions.map((item, index) => (
          <NestedCard key={index} title={t("capabilityItem", { number: index + 1 })}>
            <TextField label={t("name")} value={item.label} onChange={(label) => updateCapability(value, index, { label }, onChange)} />
            <TextField label={t("currentEvidence")} value={item.evidenceSummary} multiline onChange={(evidenceSummary) => updateCapability(value, index, { evidenceSummary }, onChange)} />
            <TextField label={t("nextStep")} value={item.nextStep} multiline onChange={(nextStep) => updateCapability(value, index, { nextStep }, onChange)} />
          </NestedCard>
        ))}
      </EditorSection>

      <EditorSection title={t("evidence")}>
        {value.evidenceMatrix.map((item, index) => (
          <NestedCard key={index} title={t("requirementItem", { number: index + 1 })}>
            <TextField label={t("requirement")} value={item.requirement} multiline onChange={(requirement) => updateArrayItem(value, "evidenceMatrix", index, { requirement }, onChange)} />
            <LinesField label={t("resumeEvidence")} suffix={t("perLine")} value={item.resumeEvidence} onChange={(resumeEvidence) => updateArrayItem(value, "evidenceMatrix", index, { resumeEvidence }, onChange)} />
            <TextField label={t("assessment")} value={item.assessment} multiline onChange={(assessment) => updateArrayItem(value, "evidenceMatrix", index, { assessment }, onChange)} />
            <TextField label={t("action")} value={item.action} multiline onChange={(action) => updateArrayItem(value, "evidenceMatrix", index, { action }, onChange)} />
          </NestedCard>
        ))}
      </EditorSection>

      <EditorSection title={t("knowledge")}>
        {value.knowledgeTopics.map((item, index) => (
          <NestedCard key={index} title={t("knowledgeItem", { number: index + 1 })}>
            <TextField label={t("topic")} value={item.topic} onChange={(topic) => updateArrayItem(value, "knowledgeTopics", index, { topic }, onChange)} />
            <TextField label={t("relevance")} value={item.whyRelevant} multiline onChange={(whyRelevant) => updateArrayItem(value, "knowledgeTopics", index, { whyRelevant }, onChange)} />
            <TextField label={t("explanation")} value={item.explanation} multiline onChange={(explanation) => updateArrayItem(value, "knowledgeTopics", index, { explanation }, onChange)} />
            <TextField label={t("currentEvidence")} value={item.currentEvidence} multiline onChange={(currentEvidence) => updateArrayItem(value, "knowledgeTopics", index, { currentEvidence }, onChange)} />
            <TextField label={t("targetLevel")} value={item.targetLevel} multiline onChange={(targetLevel) => updateArrayItem(value, "knowledgeTopics", index, { targetLevel }, onChange)} />
            <LinesField label={t("selfCheck")} suffix={t("perLine")} value={item.selfCheckQuestions} onChange={(selfCheckQuestions) => updateArrayItem(value, "knowledgeTopics", index, { selfCheckQuestions }, onChange)} />
          </NestedCard>
        ))}
      </EditorSection>

      <EditorSection title={t("deepDives")}>
        {value.deepDives.map((item, index) => (
          <NestedCard key={index} title={t("deepDiveItem", { number: index + 1 })}>
            <TextField label={t("resumeItem")} value={item.resumeItem} onChange={(resumeItem) => updateArrayItem(value, "deepDives", index, { resumeItem }, onChange)} />
            <TextField label={t("relevance")} value={item.whyRelevant} multiline onChange={(whyRelevant) => updateArrayItem(value, "deepDives", index, { whyRelevant }, onChange)} />
            <TextField label={t("contribution")} value={item.personalContributionFocus} multiline onChange={(personalContributionFocus) => updateArrayItem(value, "deepDives", index, { personalContributionFocus }, onChange)} />
            <LinesField label={t("followUps")} suffix={t("perLine")} value={item.likelyFollowUps} onChange={(likelyFollowUps) => updateArrayItem(value, "deepDives", index, { likelyFollowUps }, onChange)} />
            <LinesField label={t("facts")} suffix={t("perLine")} value={item.factsToConfirm} onChange={(factsToConfirm) => updateArrayItem(value, "deepDives", index, { factsToConfirm }, onChange)} />
          </NestedCard>
        ))}
      </EditorSection>

      <EditorSection title={t("questions")}>
        {value.targetedQuestions.map((item, index) => (
          <NestedCard key={index} title={t("questionItem", { number: index + 1 })}>
            <TextField label={t("question")} value={item.question} multiline onChange={(question) => updateArrayItem(value, "targetedQuestions", index, { question }, onChange)} />
            <TextField label={t("category")} value={item.category} onChange={(category) => updateArrayItem(value, "targetedQuestions", index, { category }, onChange)} />
            <TextField label={t("direction")} value={item.preparationDirection} multiline onChange={(preparationDirection) => updateArrayItem(value, "targetedQuestions", index, { preparationDirection }, onChange)} />
          </NestedCard>
        ))}
      </EditorSection>

      <EditorSection title={t("plan")}>
        <div className="grid gap-4 md:grid-cols-3">
          <LinesField label={t("must")} suffix={t("perLine")} value={value.preparationPlan.mustPrepare} onChange={(mustPrepare) => onChange({ ...value, preparationPlan: { ...value.preparationPlan, mustPrepare } })} />
          <LinesField label={t("should")} suffix={t("perLine")} value={value.preparationPlan.shouldPrepare} onChange={(shouldPrepare) => onChange({ ...value, preparationPlan: { ...value.preparationPlan, shouldPrepare } })} />
          <LinesField label={t("optional")} suffix={t("perLine")} value={value.preparationPlan.optional} onChange={(optional) => onChange({ ...value, preparationPlan: { ...value.preparationPlan, optional } })} />
        </div>
        <TextField label={t("selfIntro")} value={value.selfIntroduction} multiline onChange={(selfIntroduction) => onChange({ ...value, selfIntroduction })} />
        <LinesField label={t("reverseQuestions")} suffix={t("perLine")} value={value.reverseQuestions} onChange={(reverseQuestions) => onChange({ ...value, reverseQuestions })} />
      </EditorSection>
    </div>
  );
}

function updateCapability(
  value: InterviewPreparation,
  index: number,
  patch: Partial<InterviewPreparation["capabilityProfile"]["dimensions"][number]>,
  onChange: (value: InterviewPreparation) => void,
) {
  const dimensions = value.capabilityProfile.dimensions.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item);
  onChange({ ...value, capabilityProfile: { ...value.capabilityProfile, dimensions } });
}

function updateArrayItem<K extends "evidenceMatrix" | "knowledgeTopics" | "deepDives" | "targetedQuestions">(
  value: InterviewPreparation,
  key: K,
  index: number,
  patch: Partial<InterviewPreparation[K][number]>,
  onChange: (value: InterviewPreparation) => void,
) {
  const items = value[key].map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) as InterviewPreparation[K];
  onChange({ ...value, [key]: items });
}

function EditorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-4 rounded-lg border border-line bg-surface p-5 lg:p-7"><h3 className="font-serif text-xl font-semibold">{title}</h3>{children}</section>;
}

function NestedCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="space-y-3 rounded-lg border border-line bg-background p-4"><p className="text-sm font-semibold">{title}</p>{children}</div>;
}

function TextField({ label, value, multiline, onChange }: { label: string; value: string; multiline?: boolean; onChange: (value: string) => void }) {
  return <label className="block text-sm"><span className="mb-1.5 block font-medium">{label}</span>{multiline ? <textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-24 w-full resize-y rounded-lg border border-line bg-background px-3 py-2 leading-6 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" /> : <input value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-lg border border-line bg-background px-3 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />}</label>;
}

function LinesField({ label, suffix, value, onChange }: { label: string; suffix: string; value: string[]; onChange: (value: string[]) => void }) {
  return <TextField label={`${label}${suffix}`} value={value.join("\n")} multiline onChange={(text) => onChange(text.split("\n").map((item) => item.trim()).filter(Boolean))} />;
}
