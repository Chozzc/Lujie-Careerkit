"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, FileText, FolderOpen, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";

import type { InitialData } from "@/components/app/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  buildCareerArtifacts,
  buildCareerArtifactTree,
  buildCareerJobArchives,
  type CareerArtifact,
  type CareerArtifactCategory,
  type CareerLibraryTarget,
  type CareerTreeNode,
} from "@/lib/career-library";
import { readGeneralResumeOptimizationStages } from "@/lib/resume-optimization-state";
import type { ResumeContent, ResumeOptimizationMeta } from "@/lib/types";
import { cn } from "@/lib/utils";

type WorkspaceData = Pick<
  InitialData,
  "versions" | "jobs" | "applications" | "interviews" | "interviewPreparations"
>;

export function CareerLibraryWorkspace({
  data,
  target,
  onClose,
  onOpenResume,
}: {
  data: WorkspaceData;
  target: CareerLibraryTarget;
  onClose: () => void;
  onOpenResume: (versionId: string) => void;
}) {
  const t = useTranslations("careerLibrary");
  const artifacts = useMemo(() => buildCareerArtifacts(data), [data]);
  const archives = useMemo(() => buildCareerJobArchives(data, artifacts), [artifacts, data]);
  const archive = target.type === "job" ? archives.find((item) => item.id === target.id) : undefined;
  const directArtifact = target.type === "artifact"
    ? artifacts.find((item) => item.kind === target.kind && item.id === target.id)
    : undefined;
  const availableArtifacts = archive?.artifacts ?? (directArtifact ? [directArtifact] : []);
  const [selectedArtifactKey, setSelectedArtifactKey] = useState<string | null>(directArtifact?.key ?? null);
  const selectedArtifact = availableArtifacts.find((item) => item.key === selectedArtifactKey) ?? null;
  const selectedTree = selectedArtifact ? buildCareerArtifactTree(selectedArtifact) : [];
  const [selectedNodeId, setSelectedNodeId] = useState(selectedTree[0]?.id ?? "overview");

  if (!archive && !directArtifact) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <div>
          <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold">{t("notFoundTitle")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("notFoundDescription")}</p>
          <Button className="mt-6" onClick={onClose}>{t("backToLibrary")}</Button>
        </div>
      </div>
    );
  }

  const title = archive ? `${archive.company} · ${archive.role}` : artifactTitle(directArtifact!, t);
  const updatedAt = archive?.updatedAt ?? directArtifact!.updatedAt;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="no-print sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-b border-line bg-background/95 px-4 backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface-low hover:text-foreground"
            aria-label={t("backToLibrary")}
            title={t("backToLibrary")}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-serif text-lg font-semibold text-primary sm:text-xl">{title}</h1>
              {directArtifact ? <Badge variant="secondary">{t(`kinds.${directArtifact.kind}`)}</Badge> : null}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("updatedAt", { date: formatDate(updatedAt) })}</p>
          </div>
        </div>
        {selectedArtifact?.source.type === "resume-version" ? (
          <Button variant="outline" onClick={() => onOpenResume(selectedArtifact.source.value.id)}>
            <Pencil />
            <span className="hidden sm:inline">{t("openResumeEditor")}</span>
          </Button>
        ) : null}
      </header>

      <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="no-print border-b border-line bg-surface-low/60 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="p-4 lg:p-5">
            <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t("outline")}
            </p>
            {archive ? (
              <JobTree
                artifacts={archive.artifacts}
                selectedArtifactKey={selectedArtifact?.key ?? null}
                selectedNodeId={selectedNodeId}
                onSelectOverview={() => setSelectedArtifactKey(null)}
                onSelect={(artifact, nodeId) => {
                  setSelectedArtifactKey(artifact.key);
                  setSelectedNodeId(nodeId);
                }}
              />
            ) : (
              <ArtifactTree
                artifact={directArtifact!}
                nodes={buildCareerArtifactTree(directArtifact!)}
                selectedNodeId={selectedNodeId}
                onSelect={setSelectedNodeId}
              />
            )}
          </div>
        </aside>

        <main className="min-w-0 bg-background px-4 py-7 sm:px-8 lg:px-12 lg:py-10">
          <div className="mx-auto max-w-5xl">
            {archive && !selectedArtifact ? (
              <JobOverview archive={archive} />
            ) : selectedArtifact ? (
              <ArtifactContent artifact={selectedArtifact} nodeId={selectedNodeId} />
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

function JobTree({
  artifacts,
  selectedArtifactKey,
  selectedNodeId,
  onSelectOverview,
  onSelect,
}: {
  artifacts: CareerArtifact[];
  selectedArtifactKey: string | null;
  selectedNodeId: string;
  onSelectOverview: () => void;
  onSelect: (artifact: CareerArtifact, nodeId: string) => void;
}) {
  const t = useTranslations("careerLibrary");
  const [expandedCategories, setExpandedCategories] = useState<Set<CareerArtifactCategory>>(() => new Set());
  return (
    <nav className="space-y-4">
      <TreeButton active={!selectedArtifactKey} depth={0} onClick={onSelectOverview}>
        <FolderOpen className="h-4 w-4" />
        {t("tree.job-overview")}
      </TreeButton>
      {(["analysis", "resume", "interview"] as CareerArtifactCategory[]).map((category) => {
        const categoryArtifacts = artifacts.filter((artifact) => artifact.category === category);
        const expanded = expandedCategories.has(category);
        return (
          <section key={category} className="overflow-hidden rounded-xl border border-line bg-surface/45">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpandedCategories((current) => {
                const next = new Set(current);
                if (next.has(category)) next.delete(category);
                else next.add(category);
                return next;
              })}
              className={cn(
                "flex w-full items-center justify-between gap-3 bg-surface px-3 py-2.5 text-left transition hover:bg-surface-low",
                expanded && "border-b border-line",
              )}
            >
              <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-primary">
                <ChevronRight className={cn("h-4 w-4 shrink-0 transition", expanded && "rotate-90")} />
                <span className="truncate">{t(`categories.${category}`)}</span>
              </h2>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {t("categoryCount", { count: categoryArtifacts.length })}
              </span>
            </button>
            {expanded ? <div className="space-y-1">
              {category === "analysis" && categoryArtifacts[0] ? (
                <TreeNodes
                  artifact={categoryArtifacts[0]}
                  nodes={buildCareerArtifactTree(categoryArtifacts[0])}
                  selectedNodeId={selectedArtifactKey === categoryArtifacts[0].key ? selectedNodeId : ""}
                  depth={0}
                  onSelect={(nodeId) => onSelect(categoryArtifacts[0], nodeId)}
                />
              ) : categoryArtifacts.length ? categoryArtifacts.map((artifact) => {
                const tree = buildCareerArtifactTree(artifact);
                const isSelected = selectedArtifactKey === artifact.key;
                return (
                  <div key={artifact.key}>
                    <TreeButton
                      active={isSelected && selectedNodeId === tree[0]?.id}
                      depth={1}
                      onClick={() => onSelect(artifact, tree[0]?.id ?? "overview")}
                    >
                      <FileText className="h-4 w-4" />
                      <span className="truncate">{artifactTreeTitle(artifact, t)}</span>
                    </TreeButton>
                    {isSelected ? (
                      <TreeNodes
                        artifact={artifact}
                        nodes={tree}
                        selectedNodeId={selectedNodeId}
                        depth={2}
                        onSelect={(nodeId) => onSelect(artifact, nodeId)}
                      />
                    ) : null}
                  </div>
                );
              }) : (
                <p className="px-3 py-3 text-xs leading-5 text-muted-foreground">
                  {t(`emptyCategories.${category}`)}
                </p>
              )}
            </div> : null}
          </section>
        );
      })}
    </nav>
  );
}

function ArtifactTree({ artifact, nodes, selectedNodeId, onSelect }: {
  artifact: CareerArtifact;
  nodes: CareerTreeNode[];
  selectedNodeId: string;
  onSelect: (nodeId: string) => void;
}) {
  return (
    <nav>
      <TreeNodes artifact={artifact} nodes={nodes} selectedNodeId={selectedNodeId} depth={0} onSelect={onSelect} />
    </nav>
  );
}

function TreeNodes({ artifact, nodes, selectedNodeId, depth, onSelect }: {
  artifact: CareerArtifact;
  nodes: CareerTreeNode[];
  selectedNodeId: string;
  depth: number;
  onSelect: (nodeId: string) => void;
}) {
  const t = useTranslations("careerLibrary");
  return (
    <div className={cn(depth > 0 && "mt-1 space-y-1")}>
      {nodes.map((node, index) => (
        <div key={node.id}>
          <TreeButton active={selectedNodeId === node.id} depth={depth} onClick={() => onSelect(node.id)}>
            <FileText className="h-3.5 w-3.5" />
            <span className="truncate">{treeNodeLabel(artifact, node.id, index, t)}</span>
          </TreeButton>
          {node.children?.length ? (
            <TreeNodes
              artifact={artifact}
              nodes={node.children}
              selectedNodeId={selectedNodeId}
              depth={depth + 1}
              onSelect={onSelect}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function TreeButton({ active, depth, onClick, children }: {
  active: boolean;
  depth: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-lg pr-2 text-left text-sm transition",
        active ? "bg-surface text-primary shadow-sm ring-1 ring-line" : "text-muted-foreground hover:bg-surface/70 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function JobOverview({ archive }: { archive: ReturnType<typeof buildCareerJobArchives>[number] }) {
  const t = useTranslations("careerLibrary");
  const metrics = [
    ["analysis", archive.counts.analyses],
    ["tailoredResume", archive.counts.tailoredResumes],
    ["preparation", archive.counts.preparations],
    ["interview", archive.counts.interviews],
  ] as const;
  return (
    <ContentPage title={`${archive.company} · ${archive.role}`} description={archive.city || t("virtualJob")}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([key, value]) => (
          <MetricCard key={key} value={value} label={t(`overviewMetrics.${key}`)} />
        ))}
      </div>
      <ContentSection title={t("jobFilesTitle")}>
        <div className="grid gap-3 sm:grid-cols-2">
          {archive.artifacts.map((artifact) => (
            <div key={artifact.key} className="rounded-xl border border-line bg-surface-low/50 p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary/70" />
                <h3 className="font-medium">{artifactTreeTitle(artifact, t)}</h3>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t("updatedAt", { date: formatDate(artifact.updatedAt) })}</p>
            </div>
          ))}
        </div>
      </ContentSection>
    </ContentPage>
  );
}

function ArtifactContent({ artifact, nodeId }: { artifact: CareerArtifact; nodeId: string }) {
  switch (artifact.source.type) {
    case "resume-version":
      return <ResumeArtifactContent artifact={artifact} nodeId={nodeId} />;
    case "job":
      return <JobAnalysisContent artifact={artifact} nodeId={nodeId} />;
    case "interview-preparation":
      return <InterviewPreparationContent artifact={artifact} nodeId={nodeId} />;
    case "interview-session":
      return <InterviewSessionContent artifact={artifact} nodeId={nodeId} />;
  }
}

function ResumeArtifactContent({ artifact, nodeId }: { artifact: CareerArtifact; nodeId: string }) {
  const t = useTranslations("careerLibrary");
  if (artifact.source.type !== "resume-version") return null;
  const version = artifact.source.value;
  const stages = readGeneralResumeOptimizationStages(version.content);
  const meta = readOptimizationMeta(version.content);
  const base = readOptimizationBase(version.content);
  const sectionId = nodeId.startsWith("change:") ? nodeId.slice(7) : null;

  if (nodeId === "original-resume" && base) {
    return (
      <ContentPage title={t("tree.original-resume")} description={t("originalResumeDescription")}>
        <ResumeDocument content={base} />
      </ContentPage>
    );
  }
  if (nodeId === "optimized-resume") {
    return (
      <ContentPage title={t("tree.optimized-resume")} description={version.name}>
        <ResumeDocument content={version.content} />
      </ContentPage>
    );
  }
  if (nodeId === "job-relation") {
    return (
      <ContentPage title={t("tree.job-relation")} description={[artifact.company, artifact.role].filter(Boolean).join(" · ")}>
        <DefinitionGrid items={[
          [t("labels.company"), artifact.company || t("unknown")],
          [t("labels.role"), artifact.role || t("unknown")],
          [t("labels.keywords"), meta?.keywords.join("、") || t("notRecorded")],
        ]} />
      </ContentPage>
    );
  }
  if (nodeId === "diagnosis" || nodeId === "diagnosis-summary") {
    return <TextPage title={t("tree.diagnosis-summary")} text={stages?.diagnosis?.summary || t("notRecorded")} />;
  }
  if (nodeId === "strengths") {
    return <ListPage title={t("tree.strengths")} items={stages?.diagnosis?.strengths ?? []} />;
  }
  if (nodeId === "issues") {
    return (
      <ContentPage title={t("tree.issues")} description={t("issuesDescription")}>
        <div className="space-y-3">
          {(stages?.diagnosis?.issues ?? []).map((issue) => (
            <div key={issue.id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={issue.severity === "high" ? "destructive" : "secondary"}>{t(`severity.${issue.severity}`)}</Badge>
                <h3 className="font-semibold">{issue.title}</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{issue.explanation}</p>
              <p className="mt-2 text-sm leading-6"><span className="font-medium">{t("labels.suggestion")}：</span>{issue.suggestion}</p>
            </div>
          ))}
        </div>
      </ContentPage>
    );
  }
  if (nodeId === "changes") {
    return <ListPage title={t("tree.changes")} items={meta?.changes ?? []} empty={t("notRecorded")} />;
  }
  if (sectionId && base) {
    return (
      <ContentPage title={t(`resumeSections.${sectionId}`)} description={t("beforeAfterDescription")}>
        <div className="grid gap-5 xl:grid-cols-2">
          <ResumeSectionPanel title={t("before")} content={base} sectionId={sectionId} />
          <ResumeSectionPanel title={t("after")} content={version.content} sectionId={sectionId} emphasized />
        </div>
      </ContentPage>
    );
  }
  return (
    <ContentPage title={artifactTitle(artifact, t)} description={version.summary || t(`kindDescriptions.${artifact.kind}`)}>
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard value={artifact.metrics[0]} label={t("overviewMetrics.issues")} />
        <MetricCard value={artifact.metrics[1]} label={t("overviewMetrics.sections")} />
        <MetricCard value={artifact.metrics[2]} label={t("overviewMetrics.changes")} />
      </div>
      {meta?.summary ? <ContentSection title={t("optimizationSummary")}><p>{meta.summary}</p></ContentSection> : null}
    </ContentPage>
  );
}

function JobAnalysisContent({ artifact }: { artifact: CareerArtifact; nodeId: string }) {
  const t = useTranslations("careerLibrary");
  if (artifact.source.type !== "job") return null;
  const job = artifact.source.value;
  return <TextPage title={t("tree.original-jd")} text={job.jd} preserve />;
}

function InterviewPreparationContent({ artifact, nodeId }: { artifact: CareerArtifact; nodeId: string }) {
  const t = useTranslations("careerLibrary");
  if (artifact.source.type !== "interview-preparation") return null;
  const content = artifact.source.value.content;
  if (nodeId === "capability-profile") {
    return (
      <ContentPage title={t("tree.capability-profile")} description={content.capabilityProfile.overview}>
        <div className="grid gap-3 sm:grid-cols-2">
          {content.capabilityProfile.dimensions.map((dimension) => (
            <div key={dimension.label} className="rounded-xl border border-line p-4">
              <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{dimension.label}</h3><Badge variant="secondary">{t(`evidence.${dimension.evidenceLevel}`)}</Badge></div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{dimension.evidenceSummary}</p>
              <p className="mt-2 text-sm leading-6"><span className="font-medium">{t("labels.nextStep")}：</span>{dimension.nextStep}</p>
            </div>
          ))}
        </div>
      </ContentPage>
    );
  }
  if (nodeId === "evidence-gaps") {
    return (
      <ContentPage title={t("tree.evidence-gaps")} description={t("evidenceDescription")}>
        <div className="space-y-3">{content.evidenceMatrix.map((item) => <div key={item.requirement} className="rounded-xl border border-line p-4"><h3 className="font-semibold">{item.requirement}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.assessment}</p><p className="mt-2 text-sm leading-6"><span className="font-medium">{t("labels.action")}：</span>{item.action}</p></div>)}</div>
      </ContentPage>
    );
  }
  if (nodeId === "core-knowledge") {
    return <CardListPage title={t("tree.core-knowledge")} items={content.knowledgeTopics.map((item) => ({ title: item.topic, body: item.explanation, meta: item.whyRelevant }))} />;
  }
  if (nodeId === "experience-deep-dives") {
    return <CardListPage title={t("tree.experience-deep-dives")} items={content.deepDives.map((item) => ({ title: item.resumeItem, body: item.personalContributionFocus, meta: item.whyRelevant, bullets: item.likelyFollowUps }))} />;
  }
  if (nodeId === "targeted-questions") {
    return <CardListPage title={t("tree.targeted-questions")} items={content.targetedQuestions.map((item) => ({ title: item.question, body: item.preparationDirection, meta: item.category }))} />;
  }
  if (nodeId === "preparation-plan") {
    return (
      <ContentPage title={t("tree.preparation-plan")} description={t("planDescription")}>
        <ContentSection title={t("plan.must")}><BulletList items={content.preparationPlan.mustPrepare} /></ContentSection>
        <ContentSection title={t("plan.should")}><BulletList items={content.preparationPlan.shouldPrepare} /></ContentSection>
        <ContentSection title={t("plan.optional")}><BulletList items={content.preparationPlan.optional} /></ContentSection>
      </ContentPage>
    );
  }
  return (
    <ContentPage title={`${content.meta.company} · ${content.meta.title}`} description={content.meta.roleSummary}>
      <ContentSection title={t("selfIntroduction")}><p className="whitespace-pre-wrap">{content.selfIntroduction}</p></ContentSection>
      <ContentSection title={t("reverseQuestions")}><BulletList items={content.reverseQuestions} /></ContentSection>
    </ContentPage>
  );
}

function InterviewSessionContent({ artifact, nodeId }: { artifact: CareerArtifact; nodeId: string }) {
  const t = useTranslations("careerLibrary");
  if (artifact.source.type !== "interview-session") return null;
  const session = artifact.source.value;
  const questionId = nodeId.startsWith("question:") ? nodeId.slice(9) : null;
  if (questionId) {
    const question = session.questions.find((item) => item.id === questionId);
    const answer = question ? session.answers[question.id] : undefined;
    if (!question) return null;
    return (
      <ContentPage title={question.prompt} description={question.focus}>
        <ContentSection title={t("answer")}><p className="whitespace-pre-wrap">{answer?.content || t("unanswered")}</p></ContentSection>
      </ContentPage>
    );
  }
  if (nodeId === "questions") {
    return <ListPage title={t("tree.questions")} items={session.questions.map((question) => question.prompt)} />;
  }
  if (nodeId === "feedback") {
    if (session.feedback) {
      return (
        <ContentPage title={t("tree.feedback")} description={t("feedbackScore", { score: session.feedback.overallScore })}>
          <ContentSection title={t("strengths")}><BulletList items={session.feedback.strengths} /></ContentSection>
          <ContentSection title={t("improvements")}><BulletList items={session.feedback.improvements} /></ContentSection>
          <ContentSection title={t("nextActions")}><BulletList items={session.feedback.nextActions} /></ContentSection>
        </ContentPage>
      );
    }
    return <DefinitionGrid items={Object.entries(session.legacyFeedback ?? {})} />;
  }
  return (
    <ContentPage title={`${session.context.company} · ${session.context.title}`} description={t(`interviewStatus.${session.status}`)}>
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard value={session.questions.length} label={t("overviewMetrics.questions")} />
        <MetricCard value={Object.values(session.answers).filter((answer) => answer.content.trim()).length} label={t("overviewMetrics.answers")} />
        <MetricCard value={session.feedback || session.legacyFeedback ? 1 : 0} label={t("overviewMetrics.feedback")} />
      </div>
    </ContentPage>
  );
}

function ContentPage({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <article><header className="border-b border-line pb-6"><h2 className="font-serif text-3xl font-semibold text-primary">{title}</h2>{description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}</header><div className="mt-7 space-y-7">{children}</div></article>;
}
function ContentSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm"><h3 className="mb-3 text-base font-semibold text-primary">{title}</h3><div className="text-sm leading-7 text-foreground/85">{children}</div></section>;
}
function MetricCard({ value, label }: { value: number; label: string }) {
  return <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm"><p className="font-serif text-3xl font-semibold text-primary">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>;
}
function TextPage({ title, text, preserve = false }: { title: string; text: string; preserve?: boolean }) {
  return <ContentPage title={title}><div className={cn("rounded-2xl border border-line bg-surface p-6 text-sm leading-7", preserve && "whitespace-pre-wrap")}>{text}</div></ContentPage>;
}
function ListPage({ title, items, empty }: { title: string; items: string[]; empty?: string }) {
  return <ContentPage title={title}><ContentSection title={title}><BulletList items={items} empty={empty} /></ContentSection></ContentPage>;
}
function CardListPage({ title, items }: { title: string; items: Array<{ title: string; body: string; meta?: string; bullets?: string[] }> }) {
  return <ContentPage title={title}><div className="space-y-3">{items.map((item) => <div key={`${item.title}:${item.meta}`} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">{item.meta ? <p className="text-xs font-medium text-muted-foreground">{item.meta}</p> : null}<h3 className="mt-1 font-semibold text-primary">{item.title}</h3><p className="mt-2 text-sm leading-7 text-foreground/80">{item.body}</p>{item.bullets?.length ? <div className="mt-3"><BulletList items={item.bullets} /></div> : null}</div>)}</div></ContentPage>;
}
function BulletList({ items, empty }: { items: string[]; empty?: string }) {
  if (!items.length) return <p className="text-muted-foreground">{empty ?? "—"}</p>;
  return <ul className="space-y-2">{items.map((item, index) => <li key={`${item}:${index}`} className="flex gap-3"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/55" /><span>{item}</span></li>)}</ul>;
}
function DefinitionGrid({ items }: { items: Array<[string, string]> }) {
  return <div className="grid gap-3 sm:grid-cols-2">{items.map(([label, value]) => <div key={label} className="rounded-xl border border-line bg-surface p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-sm leading-6">{value || "—"}</p></div>)}</div>;
}

function ResumeDocument({ content }: { content: ResumeContent }) {
  const t = useTranslations("careerLibrary");
  const sections = ["profile", "education", "experiences", "internships", "projects", "skills", "awards", "customSections"];
  return <div className="mx-auto max-w-3xl rounded-2xl border border-line bg-white p-7 text-slate-900 shadow-sm sm:p-10"><h3 className="font-serif text-3xl font-semibold">{content.basics.name}</h3><p className="mt-1 text-sm text-slate-600">{content.profile.title}</p><div className="mt-7 space-y-7">{sections.map((section) => <ResumeSectionPanel key={section} title={t(`resumeSections.${section}`)} content={content} sectionId={section} />)}</div></div>;
}
function ResumeSectionPanel({ title, content, sectionId, emphasized = false }: { title: string; content: ResumeContent; sectionId: string; emphasized?: boolean }) {
  const value = resumeSectionLines(content, sectionId);
  if (!value.length) return null;
  return <section className={cn("rounded-xl border border-line p-4", emphasized && "border-primary/25 bg-primary/[0.025]")}><h3 className="mb-3 font-semibold text-primary">{title}</h3><div className="space-y-2 text-sm leading-6">{value.map((line, index) => <p key={`${line}:${index}`} className="whitespace-pre-wrap">{line}</p>)}</div></section>;
}

function resumeSectionLines(content: ResumeContent, sectionId: string): string[] {
  if (sectionId === "profile") return [content.profile.summary || content.selfReview].filter(Boolean);
  if (sectionId === "education") return content.education.map((item) => `${item.school} · ${item.degree} ${item.major}\n${item.highlights.join("；")}`.trim());
  if (sectionId === "experiences" || sectionId === "internships") return content[sectionId].map((item) => `${item.company} · ${item.role}\n${item.highlights.join("；")}`.trim());
  if (sectionId === "projects") return content.projects.map((item) => `${item.name} · ${item.role}\n${item.highlights.join("；")}`.trim());
  if (sectionId === "skills") return content.skills;
  if (sectionId === "awards") return content.awards;
  if (sectionId === "customSections") return (content.customSections ?? []).map((item) => `${item.title}\n${item.content}`);
  return [];
}

function readOptimizationBase(content: ResumeContent) {
  const value = (content as ResumeContent & { _tailoringBaseResume?: unknown })._tailoringBaseResume;
  return isResumeContent(value) ? value : null;
}
function readOptimizationMeta(content: ResumeContent): ResumeOptimizationMeta | null {
  const value = (content as ResumeContent & { _optimizationMeta?: unknown })._optimizationMeta;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Partial<ResumeOptimizationMeta>;
  return { company: text(record.company), title: text(record.title), keywords: strings(record.keywords), summary: text(record.summary), changes: strings(record.changes), versionName: text(record.versionName) };
}
function isResumeContent(value: unknown): value is ResumeContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<ResumeContent>;
  return Boolean(record.basics && record.profile && Array.isArray(record.projects) && Array.isArray(record.skills));
}
function strings(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function text(value: unknown) { return typeof value === "string" ? value : ""; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(); }
function artifactTitle(artifact: CareerArtifact, t: ReturnType<typeof useTranslations>) { return artifact.kind === "general-resume" || artifact.kind === "tailored-resume" ? artifact.name : `${artifact.name} · ${t(`kindShort.${artifact.kind}`)}`; }
function artifactTreeTitle(artifact: CareerArtifact, t: ReturnType<typeof useTranslations>) { return artifact.kind === "general-resume" || artifact.kind === "tailored-resume" ? artifact.name : t(`kinds.${artifact.kind}`); }
function treeNodeLabel(artifact: CareerArtifact, id: string, index: number, t: ReturnType<typeof useTranslations>) {
  if (id.startsWith("change:")) return t(`resumeSections.${id.slice(7)}`);
  if (id.startsWith("question:")) {
    if (artifact.source.type !== "interview-session") return t("tree.questions");
    const question = artifact.source.value.questions.find((item) => item.id === id.slice(9));
    return question?.prompt || t("questionNumber", { number: index + 1 });
  }
  return t(`tree.${id}`);
}
