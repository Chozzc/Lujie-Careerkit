import { z } from "zod";
import { describe, expect, it } from "vitest";

import { getEffectiveAiSettings, type StoredAiSettings } from "./settings";
import { parseAiJsonResponse, runAiObjectTask, type AiObjectExecutor } from "./tasks";

const testSchema = z.object({
  value: z.string(),
});

const successfulExecutor: AiObjectExecutor = async ({ schema }) => ({
  object: schema.parse({ value: "ai" }),
});

describe("AI task runner", () => {
  it("parses plain and fenced JSON from compatible chat models", () => {
    expect(parseAiJsonResponse('{"value":"plain"}')).toEqual({ value: "plain" });
    expect(parseAiJsonResponse('```json\n{"value":"fenced"}\n```')).toEqual({ value: "fenced" });
    expect(parseAiJsonResponse('结果如下：\n{"value":"wrapped"}\n请查收。')).toEqual({ value: "wrapped" });
  });

  it("returns AI output when settings are enabled and executor succeeds", async () => {
    const result = await runAiObjectTask(
      {
        settings: enabledLocalSettings(),
        schema: testSchema,
        system: "Return JSON.",
        prompt: "Say hi.",
        fallback: { value: "fallback" },
        taskLabel: "测试任务",
      },
      {
        generateObject: successfulExecutor,
      },
    );

    expect(result).toEqual({
      data: { value: "ai" },
      source: "ai",
      message: "测试任务已由 Ollama / LM Studio / vLLM · qwen3:8b 完成。",
    });
  });

  it("uses explicit fallback when AI is disabled", async () => {
    let called = false;

    const disabledExecutor: AiObjectExecutor = async ({ schema }) => {
      called = true;
      return { object: schema.parse({ value: "ai" }) };
    };

    const result = await runAiObjectTask(
      {
        settings: getEffectiveAiSettings({ ...baseSettings(), aiEnabled: false }),
        schema: testSchema,
        system: "Return JSON.",
        prompt: "Say hi.",
        fallback: { value: "fallback" },
        taskLabel: "测试任务",
      },
      {
        generateObject: disabledExecutor,
      },
    );

    expect(called).toBe(false);
    expect(result.source).toBe("fallback");
    expect(result.message).toContain("当前使用本地规则结果");
  });

  it("uses explicit fallback when the provider requires a missing key", async () => {
    const result = await runAiObjectTask(
      {
        settings: getEffectiveAiSettings({ ...baseSettings(), aiProvider: "openai", aiEnabled: true }),
        schema: testSchema,
        system: "Return JSON.",
        prompt: "Say hi.",
        fallback: { value: "fallback" },
        taskLabel: "测试任务",
      },
      {
        generateObject: successfulExecutor,
      },
    );

    expect(result.source).toBe("fallback");
    expect(result.message).toContain("API Key");
  });

  it("normalizes provider failures and falls back safely", async () => {
    const result = await runAiObjectTask(
      {
        settings: enabledLocalSettings(),
        schema: testSchema,
        system: "Return JSON.",
        prompt: "Say hi.",
        fallback: { value: "fallback" },
        taskLabel: "测试任务",
      },
      {
        generateObject: async () => {
          throw new Error("401 unauthorized sk-secret");
        },
      },
    );

    expect(result.source).toBe("fallback");
    expect(result.data).toEqual({ value: "fallback" });
    expect(result.message).not.toContain("sk-secret");
  });
});

function enabledLocalSettings() {
  return getEffectiveAiSettings(baseSettings());
}

function baseSettings(): StoredAiSettings {
  return {
    aiProvider: "ollama",
    aiModel: "",
    aiBaseUrl: "",
    aiApiKey: "",
    aiEnabled: true,
    aiTemperature: 0.3,
    aiLastTestedAt: null,
    aiLastTestStatus: "untested",
  };
}
