import { z } from "zod";

const text = z.string().max(6000);
const webUrl = z.url({ protocol: /^https?$/ }).max(4000);

export const campusRecordSchema = z.object({
  id: z.string().min(1).max(120),
  company: text.min(1),
  companyType: text,
  industry: text,
  recruitmentTypes: z.array(text).max(20),
  targets: z.array(text).max(20),
  location: text,
  positions: text,
  updatedAt: z.iso.date().nullable(),
  deadlineRaw: text,
  deadlineDate: z.iso.date().nullable(),
  applyUrl: webUrl.nullable(),
  noticeUrl: webUrl.nullable(),
  exams: z.array(text).max(20),
  reviewNote: text,
  sourceRows: text,
});

export const campusDatasetSchema = z.object({
  schemaVersion: z.literal(1),
  sourceName: text.min(1),
  sourceUrl: webUrl.optional(),
  preparedAt: z.iso.date(),
  records: z.array(campusRecordSchema).max(50000),
}).refine((data) => new Set(data.records.map((record) => record.id)).size === data.records.length, {
  message: "Duplicate campus record IDs",
});

export const campusQuerySchema = z.object({
  recordId: z.string().trim().min(1).max(120).optional(),
  q: z.string().trim().max(120).default(""),
  recruitmentType: z.string().max(120).default(""),
  target: z.string().max(120).default(""),
  location: z.string().trim().max(120).default(""),
  companyType: z.string().max(120).default(""),
  industry: z.string().max(120).default(""),
  exam: z.string().max(120).default(""),
  deadline: z.enum(["", "dated", "expired", "unspecified", "invalid"]).default(""),
  sort: z.enum(["updated_desc", "updated_asc", "deadline_asc", "deadline_desc", "company_asc"]).default("updated_desc"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});

export type CampusRecord = z.infer<typeof campusRecordSchema>;
export type CampusDataset = z.infer<typeof campusDatasetSchema>;
export type CampusQuery = z.infer<typeof campusQuerySchema>;
export type CampusResult = ReturnType<typeof queryCampus>;
export const CAMPUS_PAGE_SIZE = 20;

export function chinaDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function campusDeadline(record: Pick<CampusRecord, "deadlineDate" | "deadlineRaw">, today: string) {
  if (record.deadlineDate) return record.deadlineDate < today ? "expired" : "dated";
  return /^\d{4}[-/年]/.test(record.deadlineRaw) ? "invalid" : "unspecified";
}

export function queryCampus(dataset: CampusDataset | null, query: CampusQuery, today = chinaDate(), pageSize = CAMPUS_PAGE_SIZE) {
  const records = dataset?.records ?? [];
  const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const keywords = query.q.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  // ponytail: linear scans suit this small read-only catalog; use indexed storage if measured query cost grows.
  const matches = records.filter((record) => {
    if (query.recruitmentType && !record.recruitmentTypes.includes(query.recruitmentType)) return false;
    if (query.target && !record.targets.includes(query.target)) return false;
    if (query.companyType && record.companyType !== query.companyType) return false;
    if (query.industry && record.industry !== query.industry) return false;
    if (query.exam && !record.exams.includes(query.exam)) return false;
    if (query.deadline && campusDeadline(record, today) !== query.deadline) return false;
    if (query.location && !record.location.toLocaleLowerCase().includes(query.location.toLocaleLowerCase())) return false;
    const searchable = [record.company, record.positions, record.location, record.industry].join(" ").toLocaleLowerCase();
    return keywords.every((keyword) => searchable.includes(keyword));
  }).sort((a, b) => {
    let order = 0;
    if (query.sort === "company_asc") order = a.company.localeCompare(b.company, "zh-CN");
    else {
      const byDeadline = query.sort.startsWith("deadline_");
      const left = byDeadline ? a.deadlineDate : a.updatedAt;
      const right = byDeadline ? b.deadlineDate : b.updatedAt;
      // Unknown dates always follow dated records, in either direction.
      if (!left !== !right) return left ? -1 : 1;
      order = (left ?? "").localeCompare(right ?? "") * (query.sort.endsWith("desc") ? -1 : 1);
    }
    return order || a.id.localeCompare(b.id);
  });
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const page = Math.min(query.page, pages);
  return {
    source: dataset ? { name: dataset.sourceName, preparedAt: dataset.preparedAt } : null,
    asOf: today,
    totalRecords: records.length,
    total: matches.length,
    page,
    pages,
    pageSize,
    records: matches.slice((page - 1) * pageSize, page * pageSize),
    selectedRecord: records.find((record) => record.id === query.recordId) ?? null,
    facets: {
      recruitmentType: unique(records.flatMap((record) => record.recruitmentTypes)),
      target: unique(records.flatMap((record) => record.targets)),
      companyType: unique(records.map((record) => record.companyType)),
      industry: unique(records.map((record) => record.industry)),
      exam: unique(records.flatMap((record) => record.exams)),
    },
  };
}
