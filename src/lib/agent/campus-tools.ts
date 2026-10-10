import { z } from "zod";
import { campusDeadline, campusQuerySchema, chinaDate, queryCampus } from "@/lib/campus";
import { readCampusDataset } from "@/lib/campus-store";

export const campusSearchSchema = campusQuerySchema.extend({
  recordId: campusQuerySchema.shape.recordId.describe("Exact recruitment-record ID from a previous search. Reads that record in full, ignoring search filters. This is NOT a Job ID."),
  q: campusQuerySchema.shape.q.describe("Company, positions/majors, location or industry keywords. All space-separated keywords must match. Use short terms, not a natural-language sentence."),
  recruitmentType: campusQuerySchema.shape.recruitmentType.describe("Exact facet value, e.g. 秋招, 秋招提前批, 实习 or 实习（有转正机会）. These are separate categories; search separately when the user includes several."),
  target: campusQuerySchema.shape.target.describe("Exact graduation cohort, e.g. 2027届. Use returned facets for available values."),
  location: campusQuerySchema.shape.location.describe("One location substring, e.g. 杭州. Search separately for multiple alternative cities."),
  companyType: campusQuerySchema.shape.companyType.describe("Exact company-type facet value. Leave empty if unknown, then inspect returned facets."),
  industry: campusQuerySchema.shape.industry.describe("Exact industry facet value. Leave empty if unknown, then inspect returned facets."),
  exam: campusQuerySchema.shape.exam.describe("Exact exam facet value. Leave empty if unknown, then inspect returned facets."),
  deadline: campusQuerySchema.shape.deadline.describe("dated = not past the stated date; expired = past that date; unspecified = no clear date; invalid = date needs review. None proves the recruitment is open or verified."),
  sort: campusQuerySchema.shape.sort.describe("Order by update date, deadline date or company. Unknown dates always come last."),
  page: z.number().int().min(1).max(100000).default(1).describe("Search page, five summaries per page. Refine or paginate rather than treating this page as the entire catalog."),
});

export async function searchCampus(input: z.input<typeof campusSearchSchema>, today = chinaDate()) {
  const query = campusSearchSchema.parse(input);
  const dataset = await readCampusDataset().catch(() => {
    throw new Error("CAMPUS_DATA_UNAVAILABLE: The recruitment catalog could not be read. Try again later; this does not mean there are no matching records.");
  });
  const result = queryCampus(dataset, query, today, 5);
  const records = query.recordId ? (result.selectedRecord ? [result.selectedRecord] : []) : result.records;
  return {
    status: !dataset ? "no_dataset" as const : query.recordId && !records.length ? "not_found" as const : "ok" as const,
    asOf: result.asOf,
    total: query.recordId ? records.length : result.total,
    page: query.recordId ? 1 : result.page,
    pages: query.recordId ? 1 : result.pages,
    hasMore: !query.recordId && result.page < result.pages,
    ...(query.recordId ? {} : { facets: result.facets }),
    // ponytail: five short summaries keep catalog searches small; read by ID for full positions and links.
    records: records.map((record) => ({
      id: record.id,
      company: record.company,
      companyType: record.companyType,
      industry: record.industry,
      recruitmentTypes: record.recruitmentTypes,
      targets: record.targets,
      location: record.location,
      positions: query.recordId ? record.positions : record.positions.slice(0, 400),
      positionsTruncated: !query.recordId && record.positions.length > 400,
      deadlineStatus: campusDeadline(record, today),
      deadlineDate: record.deadlineDate,
      deadlineRaw: record.deadlineRaw,
      updatedAt: record.updatedAt,
      reviewNote: record.reviewNote,
      ...(query.recordId ? { applyUrl: record.applyUrl, noticeUrl: record.noticeUrl } : {}),
      href: `/campus?recordId=${encodeURIComponent(record.id)}`,
    })),
  };
}
