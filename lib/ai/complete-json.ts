import type { z } from "zod";

import { getAiEnv, getAiFallbackEnv } from "@/lib/env";
import { geminiProvider } from "./provider";
import { openaiProvider } from "./openai-provider";
import { createFallbackProvider, type ProviderEntry } from "./fallback-chain";
import type { AiResult, CompleteJsonOptions } from "./types";

/**
 * Send a prompt to the configured AI provider and parse the response
 * against a Zod schema.
 *
 * Returns `{ ok: false, error }` when:
 *  - AI is disabled via `AI_ENABLED`
 *  - `GEMINI_API_KEY` is missing
 *  - The provider response is not valid JSON
 *  - The JSON does not satisfy the supplied schema
 *  - All providers in the fallback chain fail
 *
 * This function never throws — callers always get an `AiResult<T>`.
 */
export async function completeJson<S extends z.ZodTypeAny>(
  options: CompleteJsonOptions<S>,
): Promise<AiResult<z.infer<S>>> {
  const env = getAiEnv();

  if (!env.enabled) {
    return { ok: false, error: "AI is disabled (AI_ENABLED is not true)" };
  }

  if (!env.apiKey) {
    return { ok: false, error: "GEMINI_API_KEY is not set" };
  }

  const provider =
    options.provider ?? buildFallbackProvider(env.apiKey, env.model);

  let raw: string;
  try {
    raw = await provider(options.prompt, {
      model: env.model,
      apiKey: env.apiKey,
      system: options.system,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `AI provider error: ${message}` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripMarkdownFences(raw));
  } catch {
    return { ok: false, error: "AI response is not valid JSON" };
  }

  const result = options.schema.safeParse(parsed);

  if (!result.success) {
    return {
      ok: false,
      error: `Schema validation failed: ${result.error.message}`,
    };
  }

  return { ok: true, data: result.data };
}

function buildFallbackProvider(primaryApiKey: string, primaryModel: string) {
  const fallbackEnv = getAiFallbackEnv();
  const entries: ProviderEntry[] = [];

  entries.push({
    name: "gemini-primary",
    provider: geminiProvider,
    model: primaryModel,
    apiKey: primaryApiKey,
  });

  if (fallbackEnv.fallbackModel) {
    entries.push({
      name: "gemini-fallback",
      provider: geminiProvider,
      model: fallbackEnv.fallbackModel,
      apiKey: primaryApiKey,
    });
  }

  if (fallbackEnv.openaiApiKey) {
    entries.push({
      name: "openai-fallback",
      provider: openaiProvider,
      model: fallbackEnv.openaiModel,
      apiKey: fallbackEnv.openaiApiKey,
    });
  }

  return createFallbackProvider(entries);
}

const MARKDOWN_FENCE_RE = /^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/;

function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  const match = MARKDOWN_FENCE_RE.exec(trimmed);
  return match ? match[1] : trimmed;
}
