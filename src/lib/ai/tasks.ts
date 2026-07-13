import { generateText, type LanguageModel } from "ai";
import { z } from "zod";

import { createAiModel } from "./client";
import { generateCodexBridgeObject } from "./codex-bridge";
import { normalizeAiError } from "./errors";
import type { EffectiveAiSettings } from "./settings";

export type AiTaskResult<T> = {
  data: T;
  source: "ai" | "fallback";
  message: string;
};

export type AiObjectTaskInput<TSchema extends z.ZodType> = {
  settings: EffectiveAiSettings;
  schema: TSchema;
  system: string;
  prompt: string;
  fallback: z.infer<TSchema>;
  taskLabel: string;
};

export type AiObjectExecutor = <TSchema extends z.ZodType>(input: {
  model?: LanguageModel;
  settings: EffectiveAiSettings;
  schema: TSchema;
  system: string;
  prompt: string;
  temperature: number;
}) => Promise<{ object: z.infer<TSchema> }>;

const connectionTestSchema = z.object({
  ok: z.boolean(),
});

export async function runAiObjectTask<TSchema extends z.ZodType>(
  input: AiObjectTaskInput<TSchema>,
  dependencies: { generateObject?: AiObjectExecutor; model?: LanguageModel } = {},
): Promise<AiTaskResult<z.infer<TSchema>>> {
  if (input.settings.requiresApiKey && !input.settings.apiKey) {
    return fallbackResult(input, "缺少 API Key，请先在设置页保存对应模型服务的密钥。");
  }

  if (!input.settings.enabled) {
    return fallbackResult(input, "当前使用本地规则结果。请在设置中连接 AI 后获取模型分析。");
  }

  try {
    const executor = dependencies.generateObject ?? defaultGenerateObject;
    const result = await executor({
      model: dependencies.model,
      settings: input.settings,
      schema: input.schema,
      system: input.system,
      prompt: input.prompt,
      temperature: input.settings.temperature,
    });

    return {
      data: input.schema.parse(result.object),
      source: "ai",
      message: `${input.taskLabel}已由 ${runtimeDisplayName(input.settings)} 完成。`,
    };
  } catch (error) {
    return fallbackResult(input, normalizeAiError(error).message);
  }
}

export async function testAiConnection(
  settings: EffectiveAiSettings,
  dependencies: { generateObject?: AiObjectExecutor; model?: LanguageModel } = {},
) {
  return runAiObjectTask(
    {
      settings: { ...settings, enabled: true },
      schema: connectionTestSchema,
      system: "你是连接测试助手。请只返回 JSON，不要 Markdown。",
      prompt: '返回 {"ok": true} 表示连接可用。',
      fallback: { ok: false },
      taskLabel: "连接测试",
    },
    dependencies,
  );
}

async function defaultGenerateObject<TSchema extends z.ZodType>(input: {
  model?: LanguageModel;
  settings: EffectiveAiSettings;
  schema: TSchema;
  system: string;
  prompt: string;
  temperature: number;
}) {
  if (input.settings.runtimeMode === "codex-bridge") {
    return {
      object: await generateCodexBridgeObject({
        schema: input.schema,
        system: input.system,
        prompt: input.prompt,
        model: input.settings.codexModel,
        reasoning: input.settings.codexReasoning,
      }),
    };
  }

  const schemaDescription = JSON.stringify(z.toJSONSchema(input.schema));
  const result = await generateText({
    model: input.model ?? createAiModel(input.settings),
    system: `${input.system}\n必须仅返回一个 JSON 对象，不要使用 Markdown 代码块。`,
    prompt: `JSON Schema：\n${schemaDescription}\n\n任务：\n${input.prompt}`,
    temperature: input.temperature,
  });

  return { object: input.schema.parse(parseAiJsonResponse(result.text)) };
}

function runtimeDisplayName(settings: EffectiveAiSettings) {
  if (settings.runtimeMode === "codex-bridge") {
    return `Codex 本机 · ${settings.codexModel === "default" ? "默认模型" : settings.codexModel}`;
  }
  return `${settings.provider.label} · ${settings.model}`;
}

export function parseAiJsonResponse(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidates = [trimmed, fenced].filter((candidate): candidate is string => Boolean(candidate));
  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) candidates.push(trimmed.slice(objectStart, objectEnd + 1));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next bounded JSON candidate.
    }
  }
  throw new Error("AI JSON parse failed: response did not contain a valid JSON object.");
}

function fallbackResult<TSchema extends z.ZodType>(
  input: AiObjectTaskInput<TSchema>,
  message: string,
): AiTaskResult<z.infer<TSchema>> {
  return {
    data: input.fallback,
    source: "fallback",
    message,
  };
}
