import { expect, it, vi } from "vitest";
import { generateText, stepCountIs, streamText, tool } from "ai";
import { z } from "zod";

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
  expect(getAiTemperature({ ...settings, providerId: "qwen", model: "qwen3.8-flash" })).toBe(0.3);
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
    expect(requests).toHaveLength(provider.models.length * 2);
    for (const request of requests) {
      expect(request.url).toBe("https://api.minimax.cn/v1/chat/completions");
      expect(request.body.reasoning_split).toBe(true);
    }
  } finally {
    vi.unstubAllGlobals();
  }
});

it("omits fixed sampling parameters on native services and gateways, preserving ordinary models", async () => {
  const requests: Record<string, unknown>[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    requests.push(JSON.parse(String(init.body)));
    return Response.json({ choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }] });
  }));
  try {
    for (const [providerId, modelId, temperature] of [
      ["minimax", "MiniMax-M3.1-Flash", undefined],
      ["minimax", "MiniMax-M3", undefined],
      ["minimax", "MiniMax-M2.7", 0.3],
      ["moonshot", "kimi-k3.1-pro", undefined],
      ["moonshot", "kimi-k3.1-pro-highspeed", undefined],
      ["openrouter", "openai/gpt-6.1-terra", undefined],
      ["anthropic-via-openrouter", "anthropic/claude-haiku-5.5", undefined],
      ["openrouter", "anthropic/claude-opus-5.5", undefined],
      ["one-api", "kimi-k3.1-pro", undefined],
      ["one-api", "claude-haiku-5-5", undefined],
      ["custom-openai-compatible", "MiniMax-M3.1-Flash", undefined],
      ["openrouter", "google/gemini-4-argon", 0.3],
      ["qwen", "qwen3.8-flash", 0.3],
    ] as const) {
      const provider = getAiProvider(providerId);
      const config: EffectiveAiSettings = { provider, providerId, model: modelId, baseUrl: provider.baseUrl,
        apiKey: "synthetic-key", enabled: true, temperature: 0.3, requiresApiKey: true };
      expect(getAiTemperature(config), modelId).toBe(temperature);
      await createAiModel(config).doGenerate({ temperature: getAiTemperature(config), prompt: [
        { role: "assistant", content: [{ type: "reasoning", text: "preserved reasoning" },
          { type: "tool-call", toolCallId: "call-1", toolName: "lookup", input: {} }] },
        { role: "tool", content: [{ type: "tool-result", toolCallId: "call-1", toolName: "lookup", output: { type: "text", value: "found" } }] },
      ] });
      const request = requests.at(-1)!;
      expect(request.temperature, modelId).toBe(temperature);
      if (temperature === undefined) expect(request).not.toHaveProperty("temperature");
      expect(request.messages).toEqual(expect.arrayContaining([
        expect.objectContaining({ role: "assistant", ...(["openrouter", "anthropic-via-openrouter"].includes(providerId)
          ? {} : { reasoning_content: "preserved reasoning" }), tool_calls: expect.arrayContaining([
          expect.objectContaining({ id: "call-1", function: { name: "lookup", arguments: "{}" } }),
        ]) }),
        expect.objectContaining({ role: "tool", tool_call_id: "call-1", content: "found" }),
      ]));
    }
  } finally {
    vi.unstubAllGlobals();
  }
});

it("round-trips OpenRouter encrypted reasoning through real generated and streamed SDK tool loops", async () => {
  const details = [{ type: "reasoning.encrypted", data: "synthetic-signed-payload", id: "reasoning-1", format: "anthropic-claude-v1", index: 0 }];
  const requests: Record<string, unknown>[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    const body = JSON.parse(String(init.body));
    requests.push(body);
    const first = !body.messages.some((m: { role: string }) => m.role === "tool");
    const call = { id: "call-1", type: "function", function: { name: "lookup", arguments: "{}" } };
    if (body.stream) {
      const deltas = first ? [
        { delta: { reasoning_details: details }, finish_reason: null },
        { delta: { tool_calls: [{ ...call, index: 0 }] }, finish_reason: "tool_calls" },
      ] : [{ delta: { content: "found" }, finish_reason: "stop" }];
      return new Response(deltas.map(choice => `data: ${JSON.stringify({ id: "test", choices: [{ index: 0, ...choice }] })}\n\n`).join("") + "data: [DONE]\n\n", { headers: { "Content-Type": "text/event-stream" } });
    }
    return Response.json({ id: "test", choices: [{ index: 0, message: first
      ? { role: "assistant", content: null, reasoning_details: details, tool_calls: [call] }
      : { role: "assistant", content: "found" }, finish_reason: first ? "tool_calls" : "stop" }] });
  }));
  try {
    for (const providerId of ["openrouter", "anthropic-via-openrouter", "gemini-via-openrouter"]) {
      const provider = getAiProvider(providerId);
      const model = createAiModel({ provider, providerId, model: provider.defaultModel, baseUrl: provider.baseUrl,
        apiKey: "synthetic-key", enabled: true, temperature: 0.3, requiresApiKey: true });
      const options = { model, prompt: "look up", tools: { lookup: tool({ inputSchema: z.object({}), execute: async () => "found" }) }, stopWhen: stepCountIs(2), maxRetries: 0 };
      expect((await generateText(options)).text).toBe("found");
      expect(await streamText(options).text).toBe("found");
    }
    expect(requests).toHaveLength(12);
    for (const request of requests.filter((_, index) => index % 2 === 1)) {
      expect(request.messages).toEqual(expect.arrayContaining([
        expect.objectContaining({ role: "assistant", reasoning_details: details }),
        expect.objectContaining({ role: "tool", tool_call_id: "call-1", content: "found" }),
      ]));
    }
  } finally {
    vi.unstubAllGlobals();
  }
});
