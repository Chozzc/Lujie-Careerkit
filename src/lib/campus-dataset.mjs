import { z } from "zod";

const text = z.string().max(6000);
const webUrl = z.url({ protocol: /^https?$/ }).max(4000);

const campusRecordSchema = z.object({
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
}).superRefine(({ records }, ctx) => {
  const firstSeen = new Map();
  records.forEach(({ id }, index) => {
    const first = firstSeen.get(id);
    if (first === undefined) firstSeen.set(id, index + 1);
    else ctx.addIssue({ code: "custom", path: ["records", index, "id"], message: `Duplicate ID. First used in record ${first}.` });
  });
});

/** @param {number} bytes */
export function assertCampusDatasetSize(bytes) {
  if (bytes > 50 * 1024 * 1024) throw new Error("Campus dataset exceeds 50 MiB");
}

/** @param {string} content */
export function parseCampusDataset(content) {
  if (content.startsWith("\uFEFF")) throw new SyntaxError("Save the JSON file as UTF-8 without a BOM");
  return campusDatasetSchema.parse(JSON.parse(content));
}
