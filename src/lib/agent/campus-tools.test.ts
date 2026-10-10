import { expect, it, vi } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { createAiModel } from "@/lib/ai/client";
import { readCampusDataset } from "@/lib/campus-store";
import { getAppData } from "@/lib/repository";
import { createCareerAgent } from "./career-agent";

vi.mock("@/lib/ai/client", () => ({ createAiModel: vi.fn(), getAiTemperature: vi.fn() }));
vi.mock("@/lib/campus-store", () => ({ readCampusDataset: vi.fn() }));
vi.mock("@/lib/repository");

it("runs campus search and exact reads through the Agent tool loop without approval or personal-data access", async () => {
  vi.mocked(readCampusDataset).mockResolvedValue({
    schemaVersion: 1, sourceName: "Internal source", sourceUrl: "https://source.example", preparedAt: "2026-09-26",
    records: [{
      id: "campus-1", company: "示例科技", companyType: "民企", industry: "互联网",
      recruitmentTypes: ["秋招"], targets: ["2027届"], location: "杭州", positions: "软件开发",
      updatedAt: "2026-09-26", deadlineDate: null, deadlineRaw: "尽快投递", exams: [],
      applyUrl: "https://example.com/apply", noticeUrl: null, reviewNote: "具体要求待核实", sourceRows: "2",
    }],
  });
  let step = 0;
  const model = new MockLanguageModelV3({
    doGenerate: async () => {
      step += 1;
      return {
        content: step < 3 ? [{
          type: "tool-call", toolCallId: `campus-call-${step}`, toolName: "search_campus",
          input: JSON.stringify(step === 1 ? { q: "开发", target: "2027届", location: "杭州" } : { recordId: "campus-1" }),
        }] : [{ type: "text", text: "找到示例科技，截止日期不明确，请核对招聘公告。" }],
        finishReason: { unified: step < 3 ? "tool-calls" : "stop", raw: undefined },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 10, text: 10, reasoning: 0 },
        },
        warnings: [],
      };
    },
  });
  vi.mocked(createAiModel).mockReturnValue(model);
  const agent = createCareerAgent({ enabled: true } as never, "zh-CN", "2026-09-27");
  const result = await agent.generate({ prompt: "找杭州面向2027届的软件开发招聘并查看详情" });
  expect(agent.tools.search_campus.needsApproval).toBeUndefined();
  expect(model.doGenerateCalls[0].tools?.map((tool) => tool.name)).toContain("search_campus");
  expect(result.steps).toHaveLength(3);
  expect(result.steps[0].toolResults[0]).toMatchObject({ toolName: "search_campus", output: { total: 1, records: [{ id: "campus-1" }] } });
  expect(result.steps[1].toolResults[0]).toMatchObject({
    toolName: "search_campus",
    output: { asOf: "2026-09-27", records: [{ deadlineStatus: "unspecified", applyUrl: "https://example.com/apply" }] },
  });
  expect(result.steps[0].toolResults[0].output).toHaveProperty("facets");
  expect(result.steps[1].toolResults[0].output).not.toHaveProperty("facets");
  expect(JSON.stringify(result.steps[1].toolResults)).not.toMatch(/sourceRows|sourceUrl|sourceName|preparedAt/);
  expect(getAppData).not.toHaveBeenCalled();
});
