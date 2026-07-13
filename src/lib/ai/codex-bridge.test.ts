import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { buildCodexOutputSchema, generateCodexBridgeObject, getCodexBridgeHealth, getCodexBridgeModels } from "./codex-bridge";

const originalUrl = process.env.CODEX_BRIDGE_URL;
const originalToken = process.env.CODEX_BRIDGE_TOKEN;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalUrl === undefined) delete process.env.CODEX_BRIDGE_URL;
  else process.env.CODEX_BRIDGE_URL = originalUrl;
  if (originalToken === undefined) delete process.env.CODEX_BRIDGE_TOKEN;
  else process.env.CODEX_BRIDGE_TOKEN = originalToken;
});

describe("Codex Bridge client", () => {
  it("builds a top-level object schema with every object property required", () => {
    const schema = buildCodexOutputSchema(
      z.object({
        name: z.string(),
        details: z.object({ note: z.string().optional() }).optional(),
        editor: z.unknown().optional(),
      }),
    );

    expect(schema.type).toBe("object");
    expect(schema.required).toEqual(["name", "details"]);
    expect(schema.properties).not.toHaveProperty("editor");
    expect((schema.properties as Record<string, Record<string, unknown>>).details.required).toEqual(["note"]);
  });

  it("rejects a root union before sending it to Codex", () => {
    expect(() => buildCodexOutputSchema(z.union([z.object({ ok: z.boolean() }), z.string()]))).toThrow(
      "top-level object",
    );
  });

  it("authenticates health requests without exposing the token in its result", async () => {
    process.env.CODEX_BRIDGE_URL = "http://127.0.0.1:4318";
    process.env.CODEX_BRIDGE_TOKEN = "test-token-with-at-least-24-characters";
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.headers).toMatchObject({ Authorization: `Bearer ${process.env.CODEX_BRIDGE_TOKEN}` });
      return Response.json({
        status: "ready",
        installed: true,
        authenticated: true,
        version: "codex-cli 0.144.1",
        activeRequests: 0,
        queuedRequests: 0,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const health = await getCodexBridgeHealth();
    expect(health.status).toBe("ready");
    expect(JSON.stringify(health)).not.toContain(process.env.CODEX_BRIDGE_TOKEN);
  });

  it("returns the account-aware Codex model catalog", async () => {
    process.env.CODEX_BRIDGE_TOKEN = "test-token-with-at-least-24-characters";
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain("/v1/models");
      return Response.json({
        data: [
          {
            id: "gpt-5.6-sol",
            model: "gpt-5.6-sol",
            displayName: "GPT-5.6-Sol",
            description: "Latest frontier agentic coding model.",
            isDefault: true,
            defaultReasoningEffort: "medium",
            supportedReasoningEfforts: [
              { reasoningEffort: "medium", description: "Balances speed and reasoning depth." },
              { reasoningEffort: "ultra", description: "Maximum reasoning with delegation." },
            ],
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCodexBridgeModels()).resolves.toEqual([
      expect.objectContaining({ model: "gpt-5.6-sol", isDefault: true }),
    ]);
  });

  it("sends a JSON schema and validates the returned object again", async () => {
    process.env.CODEX_BRIDGE_TOKEN = "test-token-with-at-least-24-characters";
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body.schema.properties.ok.type).toBe("boolean");
      expect(body.reasoning).toBe("medium");
      return Response.json({ requestId: body.requestId, output: { ok: true }, model: "default", durationMs: 1 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const output = await generateCodexBridgeObject({
      schema: z.object({ ok: z.boolean() }),
      system: "Return JSON.",
      prompt: "Confirm the connection.",
      model: "default",
      reasoning: "medium",
    });
    expect(output).toEqual({ ok: true });
  });

  it("sends visual inputs to the dedicated authenticated endpoint", async () => {
    process.env.CODEX_BRIDGE_URL = "http://127.0.0.1:4318";
    process.env.CODEX_BRIDGE_TOKEN = "test-token-with-at-least-24-characters";
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toContain("/v1/generate-vision");
      expect(init.headers).toMatchObject({ Authorization: `Bearer ${process.env.CODEX_BRIDGE_TOKEN}` });
      const body = JSON.parse(String(init.body));
      expect(body.images).toEqual([{ mimeType: "image/png", dataBase64: "iVBORw==" }]);
      return Response.json({ output: { name: "张三" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const output = await generateCodexBridgeObject({
      schema: z.object({ name: z.string() }),
      system: "Extract resume data.",
      prompt: "Read the attached resume image.",
      model: "default",
      reasoning: "medium",
      images: [{ mimeType: "image/png", data: Uint8Array.from([0x89, 0x50, 0x4e, 0x47]) }],
    });

    expect(output).toEqual({ name: "张三" });
  });

  it("fails closed when the shared token is missing", async () => {
    delete process.env.CODEX_BRIDGE_TOKEN;
    await expect(getCodexBridgeHealth()).rejects.toThrow("token is not configured");
  });
});
