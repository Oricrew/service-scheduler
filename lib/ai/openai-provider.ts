import type { CompletionProvider } from "./types";
import { AiProviderError, isTransientStatus } from "./errors";

const REQUEST_TIMEOUT_MS = 8_000;
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

/**
 * Lightweight OpenAI-compatible fallback provider.
 *
 * Uses fetch directly — no SDK dependency needed.
 * Intended as a last-resort fallback when Gemini is unavailable.
 */
export const openaiProvider: CompletionProvider = async (
  prompt,
  { model, apiKey, system },
) => {
  const systemContent =
    system ??
    "You are a JSON-only assistant. Reply with valid JSON and nothing else.";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (isAbortError(err)) {
      throw new AiProviderError("AI provider request timed out", {
        transient: true,
      });
    }
    throw new AiProviderError("AI provider request failed", {
      transient: true,
    });
  }

  clearTimeout(timeoutId);

  if (!res.ok) {
    const transient = isTransientStatus(res.status);
    throw new AiProviderError(`AI provider returned HTTP ${res.status}`, {
      transient,
      statusCode: res.status,
    });
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new AiProviderError("AI provider returned invalid JSON body", {
      transient: false,
    });
  }

  const content = extractContent(body);
  if (!content) {
    throw new AiProviderError("AI provider returned an empty response", {
      transient: false,
    });
  }

  return content;
};

function extractContent(body: unknown): string | undefined {
  if (
    typeof body === "object" &&
    body !== null &&
    "choices" in body &&
    Array.isArray((body as Record<string, unknown>).choices)
  ) {
    const choices = (body as { choices: unknown[] }).choices;
    const first = choices[0];
    if (
      typeof first === "object" &&
      first !== null &&
      "message" in first &&
      typeof (first as Record<string, unknown>).message === "object"
    ) {
      const message = (first as { message: Record<string, unknown> }).message;
      const text = message.content;
      if (typeof text === "string" && text.trim().length > 0) return text;
    }
  }
  return undefined;
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}
