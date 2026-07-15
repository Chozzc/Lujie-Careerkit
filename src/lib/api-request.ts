import { z } from "zod";

export const dateInputSchema = z.string().refine(isDateInput, { message: "Invalid date." });

type ParsedJson<T> =
  | { success: true; data: T }
  | { success: false; response: Response };

export async function parseJsonRequest<T>(request: Request, schema: z.ZodType<T>): Promise<ParsedJson<T>> {
  try {
    const result = schema.safeParse(await request.json());
    if (result.success) return result;
  } catch {
    // The same 400 response covers malformed JSON and schema mismatches without leaking internals.
  }

  return {
    success: false,
    response: Response.json({ error: "请求参数无效。" }, { status: 400 }),
  };
}

function isDateInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
