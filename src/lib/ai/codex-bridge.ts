import { randomUUID } from "node:crypto";

import { z } from "zod";

import type { CodexReasoning } from "./settings";

const bridgeErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

const bridgeHealthSchema = z.object({
  status: z.enum(["ready", "not-authenticated", "unavailable"]),
  installed: z.boolean(),
  authenticated: z.boolean(),
  version: z.string().nullable(),
  activeRequests: z.number(),
  queuedRequests: z.number(),
});

const codexReasoningOptionSchema = z.object({
  reasoningEffort: z.string(),
  description: z.string(),
});

const codexBridgeModelSchema = z.object({
  id: z.string(),
  model: z.string(),
  displayName: z.string(),
  description: z.string(),
  isDefault: z.boolean(),
  defaultReasoningEffort: z.string(),
  supportedReasoningEfforts: z.array(codexReasoningOptionSchema),
});

const bridgeModelsSchema = z.object({
  data: z.array(codexBridgeModelSchema),
});

export type CodexBridgeHealth = z.infer<typeof bridgeHealthSchema>;
export type CodexBridgeModel = z.infer<typeof codexBridgeModelSchema>;
export type CodexBridgeImage = {
  data: Uint8Array;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
};

export async function getCodexBridgeHealth(): Promise<CodexBridgeHealth> {
  const response = await bridgeFetch("/v1/health", { method: "GET" }, 15_000);
  return bridgeHealthSchema.parse(await readBridgeResponse(response));
}

export async function getCodexBridgeModels({ forceRefresh = false }: { forceRefresh?: boolean } = {}): Promise<CodexBridgeModel[]> {
  const response = await bridgeFetch(`/v1/models${forceRefresh ? "?refresh=1" : ""}`, { method: "GET" }, 20_000);
  return bridgeModelsSchema.parse(await readBridgeResponse(response)).data;
}

export async function generateCodexBridgeObject<TSchema extends z.ZodType>(input: {
  schema: TSchema;
  system: string;
  prompt: string;
  model: string;
  reasoning: CodexReasoning;
  images?: CodexBridgeImage[];
}): Promise<z.infer<TSchema>> {
  const images = input.images?.map((image) => ({
    mimeType: image.mimeType,
    dataBase64: Buffer.from(image.data).toString("base64"),
  }));
  const response = await bridgeFetch(
    images?.length ? "/v1/generate-vision" : "/v1/generate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: randomUUID(),
        schema: buildCodexOutputSchema(input.schema),
        system: input.system,
        prompt: input.prompt,
        model: input.model,
        reasoning: input.reasoning,
        ...(images?.length ? { images } : {}),
      }),
    },
    images?.length ? 245_000 : 185_000,
  );
  const payload = await readBridgeResponse(response);
  if (!payload || typeof payload !== "object" || !("output" in payload)) {
    throw new Error("Codex returned an invalid response.");
  }
  return input.schema.parse(payload.output);
}

async function bridgeFetch(path: string, init: RequestInit, timeoutMs: number) {
  const baseUrl = process.env.CODEX_BRIDGE_URL?.trim() || "http://127.0.0.1:4318";
  const token = process.env.CODEX_BRIDGE_TOKEN?.trim();
  if (!token) throw new Error("Codex service token is not configured.");

  try {
    return await fetch(`${baseUrl.replace(/\/+$/, "")}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(`Codex service unavailable: ${cause}`);
  }
}

async function readBridgeResponse(response: Response): Promise<unknown> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = bridgeErrorSchema.safeParse(payload);
    throw new Error(
      parsed.success
        ? `Codex ${parsed.data.error.code}: ${parsed.data.error.message}`
        : `Codex HTTP ${response.status}`,
    );
  }
  return payload;
}

export function buildCodexOutputSchema(schema: z.ZodType): Record<string, unknown> {
  const output = makeObjectPropertiesRequired(z.toJSONSchema(schema));
  if (output.type !== "object") {
    throw new Error("Codex invalid_schema: structured output must use a top-level object schema.");
  }
  return output;
}

function makeObjectPropertiesRequired(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const source = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(source)) {
    if (key === "properties" && item && typeof item === "object" && !Array.isArray(item)) {
      const properties = Object.fromEntries(
        Object.entries(item as Record<string, unknown>)
          .map(([name, property]) => [name, makeObjectPropertiesRequired(property)] as const)
          // z.unknown() becomes an unconstrained {} schema, which OpenAI
          // structured outputs reject. Such optional app-only state is not an
          // AI output field and is preserved from the original object later.
          .filter(([, property]) => Object.keys(property).length > 0),
      );
      output.properties = properties;
      output.required = Object.keys(properties);
      continue;
    }
    if (key === "required" && source.properties) continue;
    if (Array.isArray(item)) {
      output[key] = item.map((entry) =>
        entry && typeof entry === "object" && !Array.isArray(entry) ? makeObjectPropertiesRequired(entry) : entry,
      );
      continue;
    }
    output[key] = item && typeof item === "object" ? makeObjectPropertiesRequired(item) : item;
  }
  return output;
}
