import { expect, it, vi } from "vitest";

import { getAiProvider } from "./provider-registry";
import type { EffectiveAiSettings } from "./settings";
import { createAiModel, getAiTemperature } from "./client";

it("uses OpenAI Responses and omits unsupported temperature for GPT-6", () => {
  const settings: EffectiveAiSettings = {
    provider: getAiProvider("openai"),
    providerId: "openai",
    model: "gpt-6-luna",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "test-key",
    enabled: true,
    temperature: 0.3,
    requiresApiKey: true,
  };
  expect(createAiModel(settings).provider).toBe("openai.responses");
  expect(getAiTemperature(settings)).toBeUndefined();
  expect(createAiModel({ ...settings, model: "gpt-6.1-sol" }).modelId).toBe("gpt-6.1-sol");
  expect(getAiTemperature({ ...settings, model: "gpt-6.1-sol" })).toBeUndefined();
  expect(getAiTemperature({ ...settings, providerId: "qwen" })).toBe(0.3);
});

it("keeps MiniMax reasoning separate in generated and streamed responses", async () => {
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    requests.push({ url, body });
    if (body.stream) {
      return new Response('data: {"id":"test","choices":[{"index":0,"delta":{"reasoning_content":"analysis"},"finish_reason":null}]}\n\ndata: {"id":"test","choices":[{"index":0,"delta":{"content":"{\\"ok\\":true}"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n', { headers: { "Content-Type": "text/event-stream" } });
    }
    return Response.json({ id: "test", choices: [{ index: 0, message: { role: "assistant", reasoning_content: "analysis", content: '{"ok":true}' }, finish_reason: "stop" }] });
  }));
  try {
    const provider = getAiProvider("minimax");
    const prompt = [{ role: "user" as const, content: [{ type: "text" as const, text: "hi" }] }];
    for (const modelId of provider.models) {
      const model = createAiModel({ provider, providerId: provider.id, model: modelId, baseUrl: provider.baseUrl,
        apiKey: "synthetic-key", enabled: true, temperature: 0.3, requiresApiKey: true });
      const generated = await model.doGenerate({ prompt });
      expect(generated.content).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: "reasoning", text: "analysis" }),
        expect.objectContaining({ type: "text", text: '{"ok":true}' }),
      ]));
      const streamed = await model.doStream({ prompt });
      const chunks: unknown[] = [];
      await streamed.stream.pipeTo(new WritableStream({ write(chunk) { chunks.push(chunk); } }));
      expect(chunks).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: "reasoning-delta", delta: "analysis" }),
        expect.objectContaining({ type: "text-delta", delta: '{"ok":true}' }),
      ]));
    }
    expect(requests).toHaveLength(6);
    for (const request of requests) {
      expect(request.url).toBe("https://api.minimax.cn/v1/chat/completions");
      expect(request.body.reasoning_split).toBe(true);
    }
  } finally {
    vi.unstubAllGlobals();
  }
});
