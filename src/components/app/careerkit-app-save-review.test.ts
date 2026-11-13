import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import ts from "typescript";
import { expect, it, vi } from "vitest";

// Exercise the actual save handler without rendering the editor or invoking an AI provider.
const source = readFileSync(new URL("./careerkit-app.tsx", import.meta.url), "utf8");
const handler = source.slice(source.indexOf("  async function saveReviewedResume("), source.indexOf("  function cancelResumeReview("));
const javascript = ts.transpileModule(handler, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function setup(sourceVersionId?: string) {
  const original = { id: "original", resumeId: "family", content: { text: "original draft" } };
  const optimized = { id: "optimized", resumeId: "family", content: { text: "optimized draft" } };
  const state = {
    currentResumeOptimizationResult: { before: original.content, after: optimized.content, sourceVersionId },
    versions: [] as typeof original[],
    optimizationT: (key: string) => key,
    buildResumeDiffSections: () => [],
    attachGeneralResumeOptimizationState: (content: unknown) => content,
    buildResumeDisplayName: () => "Resume",
    normalizeVersion: (version: unknown) => version,
    saveResume: vi.fn(async () => { state.versions.push(original); return { kind: "version", version: original }; }),
    postJson: vi.fn(async () => ({ version: optimized })),
    setResumeOptimizationResult: (value: { before: typeof original.content; after: typeof optimized.content; sourceVersionId: string | undefined }) => { state.currentResumeOptimizationResult = value; },
    setVersions: (update: (versions: typeof original[]) => typeof original[]) => { state.versions = update(state.versions); },
    setResumeOptimizationVersionId: vi.fn(),
    setResumeOptimizationStage: vi.fn(),
    setToast: vi.fn(),
    window: { history: { pushState: vi.fn() } },
  };
  const context = createContext(state);
  runInContext(javascript, context);
  const save = () => runInContext('saveReviewedResume({ text: "optimized draft" }, { acceptedIds: [], editedValues: {} })', context) as Promise<void>;
  return { state, save, original };
}

it("saves an unsaved original before saving its optimized copy", async () => {
  const { state, save, original } = setup();
  await save();
  expect(state.saveResume).toHaveBeenCalledWith(original.content, { kind: "new" });
  expect(state.postJson).toHaveBeenCalledWith("/api/resume-versions", expect.objectContaining({ sourceResumeId: original.resumeId, baseResume: original.content }));
  expect(state.versions.map((item) => item.id).sort()).toEqual(["optimized", "original"]);
});

it("reuses the saved original after an optimized-copy save fails", async () => {
  const { state, save } = setup();
  state.postJson.mockRejectedValueOnce(new Error("temporary save failure"));
  await expect(save()).rejects.toThrow("temporary save failure");
  expect(state.currentResumeOptimizationResult.sourceVersionId).toBe("original");
  await save();
  expect(state.saveResume).toHaveBeenCalledTimes(1);
});

it("does not silently replace a missing explicitly selected source", async () => {
  const { state, save } = setup("deleted-source");
  await expect(save()).rejects.toThrow("找不到通用优化的来源简历");
  expect(state.saveResume).not.toHaveBeenCalled();
  expect(state.postJson).not.toHaveBeenCalled();
});

it("uses the saved resume ID when autosave completes during AI optimization", async () => {
  const workbench = readFileSync(new URL("../resume/resume-workbench.tsx", import.meta.url), "utf8");
  const optimizeHandler = workbench.slice(workbench.indexOf("  async function handleDiagnosisOptimization("), workbench.indexOf("  function openApplicationMessageDialog("));
  const target: { kind: string; id?: string } = { kind: "new" };
  const onResumeOptimized = vi.fn();
  const context = createContext({
    setIsOptimizingResume: vi.fn(), setStatus: vi.fn(), t: (key: string) => key,
    diagnosisResume: {}, locale: "zh-CN", editingTarget: { kind: "new" },
    saveContextRef: { current: { editingTarget: target } }, onResumeOptimized,
    optimizeResume: async () => { target.kind = "version"; target.id = "saved-during-optimization"; return { draft: {} }; },
  });
  runInContext(ts.transpileModule(optimizeHandler, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  await runInContext('handleDiagnosisOptimization({ diagnosis: { issues: [] }, selectedIssueIds: [], additionalDirection: "" })', context);
  expect(onResumeOptimized).toHaveBeenCalledWith(expect.objectContaining({ sourceVersionId: "saved-during-optimization" }));
});
