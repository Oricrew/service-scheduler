import { createHash } from "node:crypto";
import type { z } from "zod";

import { getAiEnv, getAiFallbackEnv } from "@/lib/env";
import { geminiProvider } from "./provider";
import { openaiProvider } from "./openai-provider";
import { createFallbackProvider, type ProviderEntry } from "./fallback-chain";
import type {
  AiResult,
  CompleteJsonOptions,
  CompletionProvider,
} from "./types";

/**
 * Cached fallback provider with the config fingerprint it was built for.
 * Rebuilt automatically when the resolved config changes (model names,
 * key rotation, deadline, etc.).
 */
let cachedEntry: { key: string; provider: CompletionProvider } | undefined;

function keyPrefix(raw: string): string {
  return createHash("sha256").update(raw).digest("hex").slice(0, 8);
}

function configKey(
  primaryModel: string,
  primaryApiKey: string,
  fallbackModel: string | undefined,
  openaiKey: string | undefined,
  openaiModel: string,
  totalDeadlineMs: number,
): string {
  return [
    primaryModel,
    keyPrefix(primaryApiKey),
    fallbackModel ?? "",
    openaiKey ? keyPrefix(openaiKey) : "",
    openaiModel,
    String(totalDeadlineMs),
  ].join("|");
}

/**
 * Send a prompt to the configured AI provider and parse the response
 * against a Zod schema.
 *
 * Returns `{ ok: false, error }` when:
 *  - AI is disabled via `AI_ENABLED`
 *  - `GEMINI_API_KEY` is missing
 *  - All providers in the fallback chain fail
 *  - The provider response is not valid JSON
 *  - The JSON does not satisfy the supplied schema
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
    options.provider ?? getFallbackProvider(env.apiKey, env.model);

  let raw: string;
  try {
    raw = await provider(options.prompt, {
      model: env.model,
      apiKey: env.apiKey,
      system: options.system,
      maxTokens: options.maxTokens,
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

function getFallbackProvider(
  primaryApiKey: string,
  primaryModel: string,
): CompletionProvider {
  const fallbackEnv = getAiFallbackEnv();
  const key = configKey(
    primaryModel,
    primaryApiKey,
    fallbackEnv.fallbackModel,
    fallbackEnv.openaiApiKey,
    fallbackEnv.openaiModel,
    fallbackEnv.totalDeadlineMs,
  );

  if (cachedEntry && cachedEntry.key === key) return cachedEntry.provider;

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

  const provider = createFallbackProvider(entries, {
    totalDeadlineMs: fallbackEnv.totalDeadlineMs,
  });
  cachedEntry = { key, provider };
  return provider;
}

/** Visible for testing — forces the fallback chain to be rebuilt. */
export function _resetCachedProvider(): void {
  cachedEntry = undefined;
}

const MARKDOWN_FENCE_RE = /^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/;

function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  const match = MARKDOWN_FENCE_RE.exec(trimmed);
  return match ? match[1] : trimmed;
}
