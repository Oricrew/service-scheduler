import type { z } from "zod";

import { getAiEnv } from "@/lib/env";
import { openAiCompatibleProvider } from "./provider";
import type { AiResult, CompleteJsonOptions } from "./types";

/**
 * Send a prompt to the configured AI provider and parse the response
 * against a Zod schema.
 *
 * Returns `{ ok: false, error }` when:
 *  - AI is disabled via `AI_ENABLED`
 *  - `AI_API_KEY` is missing
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
    return { ok: false, error: "AI_API_KEY is not set" };
  }

  const provider = options.provider ?? openAiCompatibleProvider;

  let raw: string;
  try {
    raw = await provider(options.prompt, {
      model: env.model,
      apiKey: env.apiKey,
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

const MARKDOWN_FENCE_RE = /^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/;

function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  const match = MARKDOWN_FENCE_RE.exec(trimmed);
  return match ? match[1] : trimmed;
}
