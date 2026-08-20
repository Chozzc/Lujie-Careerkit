import { z } from "zod";

export const dateInputSchema = z.iso.date({ error: "Invalid date." });

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
