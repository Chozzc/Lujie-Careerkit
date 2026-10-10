import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { campusDatasetSchema, campusDeadline, campusQuerySchema, chinaDate, queryCampus, type CampusDataset, type CampusRecord } from "./campus";
import { GET } from "@/app/api/campus/route";
import { searchCampus } from "@/lib/agent/campus-tools";

vi.mock("node:fs/promises", () => ({ readFile: vi.fn(), stat: vi.fn() }));

const record: CampusRecord = {
  id: "example-1", company: "示例科技", companyType: "民企", industry: "互联网",
  recruitmentTypes: ["秋招", "实习"], targets: ["2027届", "2026届"], location: "北京苏州",
  positions: "Software Engineer 软件工程师", updatedAt: "2026-09-11", deadlineRaw: "2026-09-14",
  deadlineDate: "2026-09-14", applyUrl: "https://example.com/apply", noticeUrl: null,
  exams: ["需要笔试"], reviewNote: "", sourceRows: "2",
};
const dataset: CampusDataset = { schemaVersion: 1, sourceName: "Synthetic test data", preparedAt: "2026-09-14", records: [record] };
const query = (input = {}) => campusQuerySchema.parse(input);

describe("campus catalog", () => {
  it("ships valid recruitment data without an original source URL", () => {
    const published = JSON.parse(readFileSync(new URL("../../data/campus/current.json", import.meta.url), "utf8"));
    expect(published).not.toHaveProperty("sourceUrl");
    expect(campusDatasetSchema.parse(published).records.length).toBeGreaterThan(0);
  });

  it("sorts dates in both directions with unknown dates last and filters deadline states", () => {
    const data = { ...dataset, records: [
      { ...record, id: "unknown", company: "unknown", deadlineDate: null, deadlineRaw: "尽快投递", updatedAt: null },
      { ...record, id: "later", company: "later", deadlineDate: "2026-10-01", updatedAt: "2026-09-12" },
      { ...record, id: "earlier", company: "earlier", deadlineDate: "2026-09-13" },
      { ...record, id: "invalid", company: "invalid", deadlineDate: null, deadlineRaw: "2026-11-31" },
    ] };
    const ids = (input: object) => queryCampus(data, query(input), "2026-09-14").records.map((item) => item.id);
    expect(ids({ sort: "deadline_asc" })).toEqual(["earlier", "later", "invalid", "unknown"]);
    expect(ids({ sort: "deadline_desc" })).toEqual(["later", "earlier", "invalid", "unknown"]);
    expect(ids({ sort: "updated_asc" }).at(-1)).toBe("unknown");
    expect(ids({ sort: "updated_desc" })[0]).toBe("later");
    expect(ids({ deadline: "dated", sort: "deadline_asc" })).toEqual(["later"]);
    expect(ids({ deadline: "expired" })).toEqual(["earlier"]);
    expect(ids({ deadline: "unspecified" })).toEqual(["unknown"]);
    expect(ids({ deadline: "invalid" })).toEqual(["invalid"]);
    expect(campusQuerySchema.safeParse({ sort: "bad" }).success).toBe(false);
    expect(campusQuerySchema.safeParse({ deadline: "open" }).success).toBe(false);
  });

  it("matches all keywords and exact multi-value filters without confusing early recruitment", () => {
    const data = { ...dataset, records: [record, { ...record, id: "early", recruitmentTypes: ["秋招提前批"] }] };
    expect(queryCampus(data, query({ q: "示例 SOFTWARE", recruitmentType: "秋招", target: "2027届", location: "苏州", exam: "需要笔试", industry: "互联网", companyType: "民企" })).records.map((item) => item.id)).toEqual(["example-1"]);
    expect(queryCampus(data, query({ q: "示例 销售" })).total).toBe(0);
    expect(queryCampus(data, query({ companyType: "外企" })).total).toBe(0);
    expect(queryCampus(data, query({ target: "2028届" })).total).toBe(0);
    expect(queryCampus(data, query()).facets.recruitmentType).toHaveLength(3);
  });

  it("paginates deterministically without mutating data, and clamps out-of-range pages", () => {
    const data = { ...dataset, records: Array.from({ length: 41 }, (_, i) => ({ ...record, id: String(i).padStart(3, "0"), company: String(i).padStart(3, "0"), updatedAt: i === 40 ? "2026-09-12" : record.updatedAt })) };
    const first = queryCampus(data, query());
    const second = queryCampus(data, query({ page: 2 }));
    expect(first.records[0].id).toBe("040");
    expect(first.records).toHaveLength(20);
    expect(second.records).toHaveLength(20);
    expect(new Set([...first.records, ...second.records].map((item) => item.id)).size).toBe(40);
    expect(queryCampus(data, query({ page: 999 })).page).toBe(3);
    expect(data.records[0].id).toBe("000");
    expect(queryCampus(null, query()).source).toBeNull();
  });

  it("uses the China calendar day and never treats vague or invalid dates as open recruitment", () => {
    expect(chinaDate(new Date("2026-09-13T16:00:00Z"))).toBe("2026-09-14");
    expect(campusDeadline(record, "2026-09-14")).toBe("dated");
    expect(campusDeadline(record, "2026-09-15")).toBe("expired");
    expect(campusDeadline({ deadlineDate: null, deadlineRaw: "尽快投递" }, "2026-09-14")).toBe("unspecified");
    expect(campusDeadline({ deadlineDate: null, deadlineRaw: "2026-11-31" }, "2026-09-14")).toBe("invalid");
  });

  it("reads a linked record independently of the current filters and page", () => {
    const result = queryCampus(dataset, query({ recordId: record.id, q: "不存在", page: 999 }));
    expect(result.records).toEqual([]);
    expect(result.selectedRecord).toEqual(record);
    expect(queryCampus(dataset, query({ recordId: "missing" })).selectedRecord).toBeNull();
    expect(campusQuerySchema.safeParse({ recordId: " " }).success).toBe(false);
  });

  it("rejects unsafe URLs, impossible normalized dates, duplicate IDs and invalid queries", () => {
    for (const applyUrl of ["javascript:alert(1)", "file:///etc/passwd", "data:text/html,test", "//example.com"]) {
      expect(campusDatasetSchema.safeParse({ ...dataset, records: [{ ...record, applyUrl }] }).success).toBe(false);
    }
    expect(campusDatasetSchema.safeParse({ ...dataset, records: [{ ...record, deadlineDate: "2026-11-31" }] }).success).toBe(false);
    expect(campusDatasetSchema.safeParse({ ...dataset, records: [record, record] }).success).toBe(false);
    for (const input of [{ page: 0 }, { page: 1.5 }, { page: "NaN" }, { q: "a".repeat(121) }]) expect(campusQuerySchema.safeParse(input).success).toBe(false);
  });
});

describe("read-only campus API", () => {
  let stamp = 0;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(stat).mockResolvedValue({ size: 2000, mtimeMs: ++stamp } as Awaited<ReturnType<typeof stat>>);
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(dataset));
  });

  it("returns paged data and rejects malformed requests before reading a file", async () => {
    const bad = await GET(new Request("http://localhost/api/campus?page=-1"));
    expect(bad.status).toBe(400);
    expect(stat).not.toHaveBeenCalled();
    const response = await GET(new Request("http://localhost/api/campus?q=SOFTWARE"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(body.records[0].id).toBe(record.id);
    expect(body.source).not.toHaveProperty("url");
  });

  it("distinguishes a missing dataset from a corrupt or unreadable one and recovers on retry", async () => {
    vi.mocked(stat).mockRejectedValueOnce(Object.assign(new Error("missing"), { code: "ENOENT" }));
    const empty = await GET(new Request("http://localhost/api/campus"));
    expect(empty.status).toBe(200);
    expect((await empty.json()).source).toBeNull();
    vi.mocked(readFile).mockResolvedValueOnce("broken JSON");
    expect((await GET(new Request("http://localhost/api/campus"))).status).toBe(503);
    expect((await GET(new Request("http://localhost/api/campus"))).status).toBe(200);
    vi.mocked(stat).mockRejectedValueOnce(Object.assign(new Error("denied"), { code: "EACCES" }));
    expect((await GET(new Request("http://localhost/api/campus"))).status).toBe(503);
  });

  it("shares cached data between the API and Agent and exposes only recruitment fields to the Agent", async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ ...dataset, sourceUrl: "https://internal-source.example" }));
    const response = await GET(new Request(`http://localhost/api/campus?recordId=${record.id}`));
    expect((await response.json()).selectedRecord.id).toBe(record.id);
    const result = await searchCampus({ recordId: record.id, q: "ignored" }, "2026-09-15");
    expect(readFile).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ status: "ok", total: 1, hasMore: false });
    expect(result.records[0]).toMatchObject({ id: record.id, positions: record.positions, deadlineStatus: "expired", applyUrl: record.applyUrl });
    expect(new URL(result.records[0].href, "http://localhost").searchParams.get("recordId")).toBe(record.id);
    expect(result.records[0]).not.toHaveProperty("sourceRows");
    expect(JSON.stringify(result)).not.toMatch(/sourceUrl|sourceName|preparedAt|internal-source/);
  });

  it("paginates Agent summaries across all matches and reads full positions on demand", async () => {
    const longPositions = "软件开发".repeat(200);
    const records = Array.from({ length: 7 }, (_, i) => ({ ...record, id: `record-${i}`, positions: longPositions }));
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ ...dataset, records }));
    const first = await searchCampus({ q: "软件", target: "2027届", recruitmentType: "秋招" });
    const second = await searchCampus({ q: "软件", target: "2027届", recruitmentType: "秋招", page: 2 });
    expect(first).toMatchObject({ total: 7, page: 1, pages: 2, hasMore: true });
    expect(first.records).toHaveLength(5);
    expect(second.records).toHaveLength(2);
    expect(second.hasMore).toBe(false);
    expect(new Set([...first.records, ...second.records].map((item) => item.id)).size).toBe(7);
    expect(first.records[0]).toMatchObject({ positionsTruncated: true, positions: longPositions.slice(0, 400) });
    expect(first.records[0]).not.toHaveProperty("applyUrl");
    expect((await searchCampus({ recordId: "record-0" })).records[0].positions).toBe(longPositions);
    expect((await searchCampus({ target: "2028届" })).total).toBe(0);
    expect((await searchCampus({ target: "2028届" })).facets?.target).toContain("2027届");
  });

  it("distinguishes Agent no-match, missing ID, missing data and read errors, and validates before IO", async () => {
    await expect(searchCampus({ page: 0 })).rejects.toThrow();
    expect(stat).not.toHaveBeenCalled();
    expect(await searchCampus({ q: "不存在" })).toMatchObject({ status: "ok", total: 0 });
    expect(await searchCampus({ recordId: "missing" })).toMatchObject({ status: "not_found", total: 0 });
    vi.mocked(stat).mockRejectedValueOnce(Object.assign(new Error("missing"), { code: "ENOENT" }));
    expect(await searchCampus({})).toMatchObject({ status: "no_dataset", total: 0 });
    vi.mocked(readFile).mockResolvedValueOnce("corrupt");
    await expect(searchCampus({})).rejects.toThrow("CAMPUS_DATA_UNAVAILABLE");
    expect(await searchCampus({})).toMatchObject({ status: "ok", total: 1 });
  });
});
