import { z } from "zod";

import type { CompletionProvider } from "./types";
import { AiProviderError, isTransientStatus } from "./errors";

const DEFAULT_TIMEOUT_MS = 8_000;
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

const openaiResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string(),
      }),
    }),
  ),
});

/**
 * Lightweight OpenAI-compatible fallback provider.
 *
 * Uses fetch directly — no SDK dependency needed.
 * Intended as a last-resort fallback when Gemini is unavailable.
 * Errors are wrapped in {@link AiProviderError} with a `transient`
 * flag, same as the Gemini provider.
 */
export const openaiProvider: CompletionProvider = async (
  prompt,
  { model, apiKey, system, maxTokens, timeoutMs },
) => {
  const systemContent =
    system ??
    "You are a JSON-only assistant. Reply with valid JSON and nothing else.";

  const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  let res: Response;
  try {
    res = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: prompt },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (isAbortError(err)) {
      throw new AiProviderError("AI provider request timed out", {
        transient: true,
        kind: "timeout",
      });
    }
    throw new AiProviderError("AI provider request failed", {
      transient: true,
      kind: "network",
    });
  }

  clearTimeout(timeoutId);

  if (!res.ok) {
    const transient = isTransientStatus(res.status);
    throw new AiProviderError(`AI provider returned HTTP ${res.status}`, {
      transient,
      statusCode: res.status,
      kind: "http",
    });
  }

  let rawBody: unknown;
  try {
    rawBody = await res.json();
  } catch {
    throw new AiProviderError("AI provider returned invalid JSON body", {
      transient: false,
      kind: "empty",
    });
  }

  const parsed = openaiResponseSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AiProviderError("AI provider returned an unexpected body shape", {
      transient: false,
      kind: "empty",
    });
  }

  const content = parsed.data.choices[0]?.message.content;
  if (!content || content.trim().length === 0) {
    throw new AiProviderError("AI provider returned an empty response", {
      transient: false,
      kind: "empty",
    });
  }

  return content;
};

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}
